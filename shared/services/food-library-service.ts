import type { Food, NutritionValues } from '../types';
import type { Repository } from '../repository';
import { ServiceError } from '../repository';
import { createAdHocFood } from './food-catalog-service';
import { SYSTEM_FOODS } from '../data/system-foods';

export interface ClientFood {
  _id: string;
  name: string;
  brand?: string;
  category?: string;
  per100g: NutritionValues;
  source: 'system' | 'user' | 'recipe';
  isSaved: boolean;
  linkedFoodId?: string;
  nutritionMeta: { source: string; version: string };
  createdAt: number;
  updatedAt: number;
}

export interface SaveFoodInput {
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
  [key: string]: unknown;
}

function toClientFood(food: Food): ClientFood {
  return {
    _id: food._id as string,
    name: food.name,
    brand: food.brand,
    category: food.category,
    per100g: food.per100g,
    source: food.source,
    isSaved: food.isSaved,
    linkedFoodId: food.linkedFoodId,
    nutritionMeta: food.nutritionMeta,
    createdAt: food.createdAt,
    updatedAt: food.updatedAt,
  };
}

function findSystemFoodById(id: string | undefined): Food | undefined {
  if (!id) return undefined;
  return SYSTEM_FOODS.find((food) => food._id === id);
}

function samePer100g(a: NutritionValues, b: NutritionValues): boolean {
  return (
    a.calories === b.calories &&
    a.protein === b.protein &&
    a.carb === b.carb &&
    a.fat === b.fat
  );
}

function isSameSavedFood(a: Food, b: Food): boolean {
  if (a.linkedFoodId && b.linkedFoodId) return a.linkedFoodId === b.linkedFoodId;
  return (
    a.source === b.source &&
    a.name === b.name &&
    a.brand === b.brand &&
    a.category === b.category &&
    samePer100g(a.per100g, b.per100g)
  );
}

async function normalizeFoodInput(
  repo: Repository,
  openid: string,
  input: SaveFoodInput,
): Promise<Food> {
  const systemFood = findSystemFoodById(
    typeof input.linkedFoodId === 'string'
      ? input.linkedFoodId
      : typeof input._id === 'string'
        ? input._id
        : undefined,
  );
  if (systemFood) return systemFood;

  if (typeof input._id === 'string') {
    const stored = await repo.getFood(input._id);
    if (stored) {
      if (stored.ownerOpenid !== openid) {
        throw new ServiceError('forbidden', 'saved food does not belong to caller');
      }
      return stored;
    }
  }

  const per100g = input.per100g as Partial<NutritionValues> | undefined;
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

export async function listSavedFoods(
  repo: Repository,
  openid: string,
): Promise<ClientFood[]> {
  if (!openid) throw new ServiceError('invalid_input', 'openid is required');
  const foods = await repo.listFoods(openid);
  return foods
    .slice()
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map(toClientFood);
}

export async function saveFood(
  repo: Repository,
  openid: string,
  input: SaveFoodInput,
): Promise<ClientFood> {
  if (!openid) throw new ServiceError('invalid_input', 'openid is required');
  if (!input || typeof input !== 'object') {
    throw new ServiceError('validation', 'food input must be an object');
  }

  const resolved = await normalizeFoodInput(repo, openid, input);
  const existing = await repo.listFoods(openid);
  const duplicate = existing.find((food) => isSameSavedFood(food, resolved));
  if (duplicate) return toClientFood(duplicate);

  const now = Date.now();
  const saved: Food = {
    name: resolved.name,
    brand: resolved.brand,
    category: resolved.category,
    per100g: resolved.per100g,
    source: resolved.source,
    ownerOpenid: openid,
    isSaved: true,
    linkedFoodId:
      resolved.linkedFoodId ?? (resolved.source === 'system' ? resolved._id : undefined),
    nutritionMeta: resolved.nutritionMeta,
    createdAt: now,
    updatedAt: now,
  };
  const created = await repo.createFood(saved);
  return toClientFood(created);
}

export async function removeSavedFood(
  repo: Repository,
  openid: string,
  foodId: string,
): Promise<void> {
  if (!openid) throw new ServiceError('invalid_input', 'openid is required');
  if (!foodId || !foodId.trim()) {
    throw new ServiceError('validation', 'foodId is required');
  }
  const food = await repo.getFood(foodId);
  if (!food) throw new ServiceError('not_found', 'saved food not found');
  if (food.ownerOpenid !== openid) {
    throw new ServiceError('forbidden', 'saved food does not belong to caller');
  }
  await repo.deleteFood(foodId);
}

export { toClientFood };
