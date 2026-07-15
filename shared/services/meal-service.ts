import { MEAL_TYPES } from '../constants';
import type { MealType, RecordSource, FoodSource } from '../constants';
import type {
  Food,
  FoodSnapshot,
  Meal,
  MealItem,
  NutritionPer100g,
  NutritionValues,
} from '../types';
import type { Repository } from '../repository';
import { ServiceError } from '../repository';
import { isIsoDate } from '../validation';
import { gramsFromPortion, scaleNutrition, sumNutrition } from '../nutrition';
import { createAdHocFood } from './food-catalog-service';
import { SYSTEM_FOODS, SYSTEM_PORTION_UNITS } from '../data/system-foods';
import { genericPortionUnits, getAvailablePortionUnits } from './portion-service';

export interface MealDraftFoodInput {
  _id?: unknown;
  name?: unknown;
  brand?: unknown;
  category?: unknown;
  per100g?: unknown;
  source?: unknown;
  nutritionMeta?: unknown;
}

export interface MealDraftItemInput {
  food?: unknown;
  quantity?: unknown;
  portionLabel?: unknown;
  [key: string]: unknown;
}

export interface CreateMealInput {
  requestId?: unknown;
  familyProfileId?: unknown;
  date?: unknown;
  mealType?: unknown;
  items?: unknown;
  note?: unknown;
  source?: unknown;
  totals?: unknown;
  ownerOpenid?: unknown;
  [key: string]: unknown;
}

export interface ClientMeal {
  _id: string;
  familyProfileId: string;
  date: string;
  mealType: MealType;
  items: MealItem[];
  totals: NutritionValues;
  note?: string;
  photoFileId?: string;
  source: RecordSource;
  createdAt: number;
  updatedAt: number;
}

const MAX_NOTE = 200;

function asNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ServiceError('validation', `${field} is required`);
  }
  return value.trim();
}

function asPositiveNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new ServiceError('validation', `${field} must be a finite number > 0`);
  }
  return value;
}

function normalizeMealType(value: unknown): MealType {
  if (typeof value !== 'string' || !MEAL_TYPES.includes(value as MealType)) {
    throw new ServiceError(
      'validation',
      `mealType must be one of ${MEAL_TYPES.join(', ')}`,
    );
  }
  return value as MealType;
}

function normalizeNote(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') {
    throw new ServiceError('validation', 'note must be a string when provided');
  }
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > MAX_NOTE) {
    throw new ServiceError('validation', `note must be at most ${MAX_NOTE} characters`);
  }
  return trimmed;
}

function resolveSystemFood(foodId: string | undefined): Food | undefined {
  if (!foodId) return undefined;
  return SYSTEM_FOODS.find((food) => food._id === foodId);
}

function normalizeAdHocFood(input: MealDraftFoodInput): Food {
  const per100g = input.per100g as Partial<NutritionPer100g> | undefined;
  return createAdHocFood({
    name: input.name,
    brand: input.brand,
    category: input.category,
    calories: per100g?.calories,
    protein: per100g?.protein,
    carb: per100g?.carb,
    fat: per100g?.fat,
  });
}

function resolveFood(foodInput: unknown, index: number): Food {
  if (!foodInput || typeof foodInput !== 'object') {
    throw new ServiceError('validation', `items[${index}].food must be an object`);
  }
  const input = foodInput as MealDraftFoodInput;
  const foodId = typeof input._id === 'string' ? input._id : undefined;
  const systemFood = resolveSystemFood(foodId);
  if (systemFood) return systemFood;
  return normalizeAdHocFood(input);
}

function toFoodSnapshot(food: Food): FoodSnapshot {
  return {
    foodId: food._id,
    name: food.name,
    brand: food.brand,
    category: food.category,
    per100g: food.per100g,
    source: food.source as FoodSource,
    nutritionMeta: food.nutritionMeta,
  };
}

function resolvePortionUnit(food: Food, portionLabel: unknown, index: number) {
  const label = asNonEmptyString(portionLabel, `items[${index}].portionLabel`);
  const units = getAvailablePortionUnits(
    food._id,
    genericPortionUnits(),
    food._id ? SYSTEM_PORTION_UNITS : [],
  );
  const unit = units.find((candidate) => candidate.label === label);
  if (!unit) {
    throw new ServiceError(
      'validation',
      `items[${index}].portionLabel is not valid for the selected food`,
    );
  }
  return unit;
}

function normalizeMealItems(items: unknown): MealItem[] {
  if (!Array.isArray(items) || items.length === 0) {
    throw new ServiceError('validation', 'items must be a non-empty array');
  }

  return items.map((item, index) => {
    if (!item || typeof item !== 'object') {
      throw new ServiceError('validation', `items[${index}] must be an object`);
    }
    const input = item as MealDraftItemInput;
    const food = resolveFood(input.food, index);
    const quantity = asPositiveNumber(input.quantity, `items[${index}].quantity`);
    const unit = resolvePortionUnit(food, input.portionLabel, index);
    const grams = gramsFromPortion(quantity, unit.gramsPerUnit);
    const nutrition = scaleNutrition(food.per100g, grams);

    return {
      foodId: food._id,
      foodName: food.name,
      foodSnapshot: toFoodSnapshot(food),
      quantity,
      portionLabel: unit.label,
      portionGramsPerUnit: unit.gramsPerUnit,
      grams,
      nutrition,
      source: 'manual',
      confirmed: true,
    };
  });
}

async function assertOwnedProfile(
  repo: Repository,
  openid: string,
  familyProfileId: string,
): Promise<void> {
  const profile = await repo.getProfile(familyProfileId);
  if (!profile) throw new ServiceError('not_found', 'family profile not found');
  if (profile.ownerOpenid !== openid) {
    throw new ServiceError('forbidden', 'family profile does not belong to caller');
  }
}

export async function createMeal(
  repo: Repository,
  openid: string,
  input: CreateMealInput,
): Promise<Meal> {
  if (!openid) throw new ServiceError('invalid_input', 'openid is required');
  if (!input || typeof input !== 'object') {
    throw new ServiceError('validation', 'meal input must be an object');
  }

  const requestId = asNonEmptyString(input.requestId, 'requestId');
  const familyProfileId = asNonEmptyString(input.familyProfileId, 'familyProfileId');
  const date = asNonEmptyString(input.date, 'date');
  if (!isIsoDate(date)) {
    throw new ServiceError('validation', 'date must be YYYY-MM-DD');
  }
  const mealType = normalizeMealType(input.mealType);
  await assertOwnedProfile(repo, openid, familyProfileId);

  const normalizedItems = normalizeMealItems(input.items);
  const totals = sumNutrition(
    normalizedItems.filter((item) => item.confirmed).map((item) => item.nutrition),
  );
  const note = normalizeNote(input.note);
  const now = Date.now();

  const meal: Meal = {
    ownerOpenid: openid,
    requestId,
    familyProfileId,
    date,
    mealType,
    items: normalizedItems,
    totals,
    note,
    source: 'manual',
    createdAt: now,
    updatedAt: now,
  };

  return repo.createMeal(meal);
}

export async function getMeal(
  repo: Repository,
  openid: string,
  mealId: string,
): Promise<Meal> {
  if (!openid) throw new ServiceError('invalid_input', 'openid is required');
  const id = asNonEmptyString(mealId, 'mealId');
  const meal = await repo.getMeal(id);
  if (!meal) throw new ServiceError('not_found', 'meal not found');
  if (meal.ownerOpenid !== openid) {
    throw new ServiceError('forbidden', 'meal does not belong to caller');
  }
  return meal;
}

export function toClientMeal(meal: Meal): ClientMeal {
  return {
    _id: meal._id as string,
    familyProfileId: meal.familyProfileId,
    date: meal.date,
    mealType: meal.mealType,
    items: meal.items,
    totals: meal.totals,
    note: meal.note,
    photoFileId: meal.photoFileId,
    source: meal.source,
    createdAt: meal.createdAt,
    updatedAt: meal.updatedAt,
  };
}
