import { MEAL_TYPES } from '../constants';
import type {
  Food,
  FoodSnapshot,
  Meal,
  MealItem,
  NutritionPer100g,
  NutritionValues,
  Recipe,
} from '../types';
import type { MealType, RecordSource, ItemSource, FoodSource } from '../constants';
import type { Repository } from '../repository';
import { ServiceError } from '../repository';
import { isIsoDate } from '../validation';
import { gramsFromPortion, scaleNutrition, sumNutrition } from '../nutrition';
import { createAdHocFood } from './food-catalog-service';
import { SYSTEM_FOODS, SYSTEM_PORTION_UNITS } from '../data/system-foods';
import { genericPortionUnits, getAvailablePortionUnits } from './portion-service';
import { getAiAnalysis } from './ai-analysis-service';
import { recipeToFood, recipeToPortionUnit } from './recipe-service';

export interface MealDraftFoodInput {
  _id?: unknown;
  linkedFoodId?: unknown;
  name?: unknown;
  brand?: unknown;
  category?: unknown;
  per100g?: unknown;
  source?: unknown;
  nutritionMeta?: unknown;
  calories?: unknown;
  protein?: unknown;
  carb?: unknown;
  fat?: unknown;
}

export interface MealDraftItemInput {
  food?: unknown;
  quantity?: unknown;
  portionLabel?: unknown;
  source?: unknown;
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
  photoFileId?: unknown;
  aiAnalysisId?: unknown;
  [key: string]: unknown;
}

export interface UpdateMealInput {
  familyProfileId?: unknown;
  date?: unknown;
  mealType?: unknown;
  items?: unknown;
  note?: unknown;
  photoFileId?: unknown;
  aiAnalysisId?: unknown;
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
  aiAnalysisId?: string;
  source: RecordSource;
  createdAt: number;
  updatedAt: number;
}

export interface ClientMealListResult {
  meals: ClientMeal[];
  totals: NutritionValues;
}

interface ResolvedFood {
  food: Food;
  recipe?: Recipe;
}

const MAX_NOTE = 200;

function asNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ServiceError('validation', `${field} is required`);
  }
  return value.trim();
}

function asOptionalString(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') {
    throw new ServiceError('validation', `${field} must be a string when provided`);
  }
  const trimmed = value.trim();
  return trimmed || undefined;
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

function normalizeItemSource(value: unknown): ItemSource {
  return value === 'ai_suggested' ? 'ai_suggested' : 'manual';
}

function findSystemFood(foodId: string | undefined): Food | undefined {
  if (!foodId) return undefined;
  return SYSTEM_FOODS.find((food) => food._id === foodId);
}

function normalizeAdHocFood(input: MealDraftFoodInput): Food {
  const per100g = input.per100g as Partial<NutritionPer100g> | undefined;
  return createAdHocFood({
    name: input.name,
    brand: input.brand,
    category: input.category,
    calories: per100g?.calories ?? input.calories,
    protein: per100g?.protein ?? input.protein,
    carb: per100g?.carb ?? input.carb,
    fat: per100g?.fat ?? input.fat,
  });
}

function toFoodSnapshot(food: Food): FoodSnapshot {
  return {
    foodId: food._id,
    linkedFoodId: food.linkedFoodId,
    name: food.name,
    brand: food.brand,
    category: food.category,
    per100g: food.per100g,
    source: food.source as FoodSource,
    nutritionMeta: food.nutritionMeta,
  };
}

async function resolveFood(
  repo: Repository,
  openid: string,
  foodInput: unknown,
  index: number,
): Promise<ResolvedFood> {
  if (!foodInput || typeof foodInput !== 'object') {
    throw new ServiceError('validation', `items[${index}].food must be an object`);
  }
  const input = foodInput as MealDraftFoodInput;
  const rawId = typeof input._id === 'string' ? input._id : undefined;
  const linkedFoodId = typeof input.linkedFoodId === 'string' ? input.linkedFoodId : undefined;
  const systemFood = findSystemFood(linkedFoodId || rawId);
  if (systemFood) return { food: systemFood };

  if (rawId) {
    const savedFood = await repo.getFood(rawId);
    if (savedFood) {
      if (savedFood.ownerOpenid !== openid) {
        throw new ServiceError('forbidden', 'saved food does not belong to caller');
      }
      const linked = findSystemFood(savedFood.linkedFoodId);
      return { food: linked || savedFood };
    }

    const recipe = await repo.getRecipe(rawId);
    if (recipe) {
      if (recipe.ownerOpenid !== openid) {
        throw new ServiceError('forbidden', 'recipe does not belong to caller');
      }
      return { food: recipeToFood(recipe), recipe };
    }
  }

  return { food: normalizeAdHocFood(input) };
}

function resolvePortionUnit(
  resolved: ResolvedFood,
  portionLabel: unknown,
  index: number,
) {
  const label = asNonEmptyString(portionLabel, `items[${index}].portionLabel`);
  const generic = genericPortionUnits();
  const units = resolved.recipe
    ? [recipeToPortionUnit(resolved.recipe), ...generic]
    : getAvailablePortionUnits(
        resolved.food.linkedFoodId || resolved.food._id,
        generic,
        SYSTEM_PORTION_UNITS,
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

async function normalizeMealItems(
  repo: Repository,
  openid: string,
  items: unknown,
): Promise<MealItem[]> {
  if (!Array.isArray(items) || items.length === 0) {
    throw new ServiceError('validation', 'items must be a non-empty array');
  }

  const normalized: MealItem[] = [];
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (!item || typeof item !== 'object') {
      throw new ServiceError('validation', `items[${index}] must be an object`);
    }
    const input = item as MealDraftItemInput;
    const resolved = await resolveFood(repo, openid, input.food, index);
    const quantity = asPositiveNumber(input.quantity, `items[${index}].quantity`);
    const unit = resolvePortionUnit(resolved, input.portionLabel, index);
    const grams = gramsFromPortion(quantity, unit.gramsPerUnit);
    const nutrition = scaleNutrition(resolved.food.per100g, grams);

    normalized.push({
      foodId: resolved.food._id,
      foodName: resolved.food.name,
      foodSnapshot: toFoodSnapshot(resolved.food),
      quantity,
      portionUnitId: unit._id,
      portionLabel: unit.label,
      portionGramsPerUnit: unit.gramsPerUnit,
      grams,
      nutrition,
      source: normalizeItemSource(input.source),
      confirmed: true,
    });
  }
  return normalized;
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

async function normalizeAiAnalysisId(
  repo: Repository,
  openid: string,
  value: unknown,
): Promise<string | undefined> {
  const aiAnalysisId = asOptionalString(value, 'aiAnalysisId');
  if (!aiAnalysisId) return undefined;
  await getAiAnalysis(repo, openid, aiAnalysisId);
  return aiAnalysisId;
}

function computeMealSource(items: MealItem[], aiAnalysisId?: string): RecordSource {
  if (aiAnalysisId || items.some((item) => item.source === 'ai_suggested')) {
    return 'ai_assisted';
  }
  return 'manual';
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
  if (!isIsoDate(date)) throw new ServiceError('validation', 'date must be YYYY-MM-DD');
  const mealType = normalizeMealType(input.mealType);
  await assertOwnedProfile(repo, openid, familyProfileId);

  const normalizedItems = await normalizeMealItems(repo, openid, input.items);
  const totals = sumNutrition(
    normalizedItems.filter((item) => item.confirmed).map((item) => item.nutrition),
  );
  const aiAnalysisId = await normalizeAiAnalysisId(repo, openid, input.aiAnalysisId);
  const note = normalizeNote(input.note);
  const photoFileId = asOptionalString(input.photoFileId, 'photoFileId');
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
    photoFileId,
    aiAnalysisId,
    source: computeMealSource(normalizedItems, aiAnalysisId),
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

export async function listMeals(
  repo: Repository,
  openid: string,
  familyProfileId: string,
  date: string,
): Promise<ClientMealListResult> {
  if (!openid) throw new ServiceError('invalid_input', 'openid is required');
  const normalizedProfileId = asNonEmptyString(familyProfileId, 'familyProfileId');
  const normalizedDate = asNonEmptyString(date, 'date');
  if (!isIsoDate(normalizedDate)) {
    throw new ServiceError('validation', 'date must be YYYY-MM-DD');
  }
  await assertOwnedProfile(repo, openid, normalizedProfileId);
  const meals = await repo.listMeals(openid, normalizedProfileId, normalizedDate);
  const sorted = meals.slice().sort((a, b) => {
    if (a.createdAt === b.createdAt) return a.mealType.localeCompare(b.mealType);
    return a.createdAt - b.createdAt;
  });
  return {
    meals: sorted.map(toClientMeal),
    totals: sumNutrition(sorted.map((meal) => meal.totals)),
  };
}

export async function updateMeal(
  repo: Repository,
  openid: string,
  mealId: string,
  input: UpdateMealInput,
): Promise<Meal> {
  const current = await getMeal(repo, openid, mealId);
  if (!input || typeof input !== 'object') {
    throw new ServiceError('validation', 'meal update input must be an object');
  }

  const familyProfileId =
    input.familyProfileId === undefined
      ? current.familyProfileId
      : asNonEmptyString(input.familyProfileId, 'familyProfileId');
  const date =
    input.date === undefined ? current.date : asNonEmptyString(input.date, 'date');
  if (!isIsoDate(date)) throw new ServiceError('validation', 'date must be YYYY-MM-DD');
  const mealType =
    input.mealType === undefined ? current.mealType : normalizeMealType(input.mealType);
  await assertOwnedProfile(repo, openid, familyProfileId);

  const items =
    input.items === undefined
      ? current.items
      : await normalizeMealItems(repo, openid, input.items);
  const totals = sumNutrition(items.filter((item) => item.confirmed).map((item) => item.nutrition));
  const aiAnalysisId =
    input.aiAnalysisId === undefined
      ? current.aiAnalysisId
      : await normalizeAiAnalysisId(repo, openid, input.aiAnalysisId);
  const note = input.note === undefined ? current.note : normalizeNote(input.note);
  const photoFileId =
    input.photoFileId === undefined
      ? current.photoFileId
      : asOptionalString(input.photoFileId, 'photoFileId');

  return repo.updateMeal(mealId, {
    ...current,
    familyProfileId,
    date,
    mealType,
    items,
    totals,
    aiAnalysisId,
    note,
    photoFileId,
    source: computeMealSource(items, aiAnalysisId),
    updatedAt: Date.now(),
  });
}

export async function deleteMeal(
  repo: Repository,
  openid: string,
  mealId: string,
): Promise<void> {
  await getMeal(repo, openid, mealId);
  await repo.deleteMeal(mealId);
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
    aiAnalysisId: meal.aiAnalysisId,
    source: meal.source,
    createdAt: meal.createdAt,
    updatedAt: meal.updatedAt,
  };
}
