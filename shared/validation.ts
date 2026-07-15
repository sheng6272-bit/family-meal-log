/**
 * Lightweight, dependency-free runtime validators shared by frontend and
 * cloud functions. We deliberately avoid a schema library (e.g. zod) to honour
 * the "minimal third-party dependencies" constraint. These validators are used
 * to guard writes on the client for fast feedback AND on the server for trust.
 */

import {
  MEAL_TYPES,
  RECORD_SOURCES,
  ITEM_SOURCES,
  FOOD_SOURCES,
  FAMILY_RELATIONS,
} from './constants';
import type {
  Food,
  FoodSnapshot,
  FamilyProfile,
  Meal,
  MealItem,
  NutritionValues,
  PortionUnit,
  Recipe,
  NutritionDataMetadata,
} from './types';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

function ok(): ValidationResult {
  return { valid: true, errors: [] };
}
function fail(errors: string[]): ValidationResult {
  return { valid: errors.length === 0, errors };
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}
function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}
function isNonNegative(v: unknown): v is number {
  return isFiniteNumber(v) && v >= 0;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export function isIsoDate(v: unknown): v is string {
  return typeof v === 'string' && DATE_RE.test(v);
}

export function validateNutrition(n: unknown, path = 'nutrition'): ValidationResult {
  const errors: string[] = [];
  const o = n as Partial<NutritionValues>;
  if (!o || typeof o !== 'object') return fail([`${path} must be an object`]);
  for (const key of ['calories', 'protein', 'carb', 'fat'] as const) {
    if (!isNonNegative(o[key])) errors.push(`${path}.${key} must be a number >= 0`);
  }
  return fail(errors);
}

export function validateFood(food: unknown): ValidationResult {
  const errors: string[] = [];
  const f = food as Partial<Food>;
  if (!f || typeof f !== 'object') return fail(['food must be an object']);
  if (!isNonEmptyString(f.name)) errors.push('food.name is required');
  if (!f.per100g) errors.push('food.per100g is required');
  else errors.push(...validateNutrition(f.per100g, 'food.per100g').errors);
  if (!f.source || !FOOD_SOURCES.includes(f.source)) {
    errors.push(`food.source must be one of ${FOOD_SOURCES.join(', ')}`);
  }
  if (typeof f.isSaved !== 'boolean') errors.push('food.isSaved must be a boolean');
  if (!f.nutritionMeta || typeof f.nutritionMeta !== 'object') {
    errors.push('food.nutritionMeta is required');
  } else {
    const meta = f.nutritionMeta as Partial<NutritionDataMetadata>;
    if (!isNonEmptyString(meta.source)) {
      errors.push('food.nutritionMeta.source must be a non-empty string');
    }
    if (!isNonEmptyString(meta.version)) {
      errors.push('food.nutritionMeta.version must be a non-empty string');
    }
  }
  return fail(errors);
}

export function validatePortionUnit(unit: unknown): ValidationResult {
  const errors: string[] = [];
  const u = unit as Partial<PortionUnit>;
  if (!u || typeof u !== 'object') return fail(['portionUnit must be an object']);
  if (!isNonEmptyString(u.label)) errors.push('portionUnit.label is required');
  if (!isFiniteNumber(u.gramsPerUnit) || (u.gramsPerUnit as number) <= 0) {
    errors.push('portionUnit.gramsPerUnit must be a number > 0');
  }
  return fail(errors);
}

export function validateFamilyProfile(profile: unknown): ValidationResult {
  const errors: string[] = [];
  const p = profile as Partial<FamilyProfile>;
  if (!p || typeof p !== 'object') return fail(['familyProfile must be an object']);
  if (!isNonEmptyString(p.ownerOpenid)) errors.push('familyProfile.ownerOpenid is required');
  if (!isNonEmptyString(p.name)) errors.push('familyProfile.name is required');
  if (!p.relation || !FAMILY_RELATIONS.includes(p.relation)) {
    errors.push(`familyProfile.relation must be one of ${FAMILY_RELATIONS.join(', ')}`);
  }
  if (p.heightCm !== undefined && !isNonNegative(p.heightCm)) {
    errors.push('familyProfile.heightCm must be >= 0 when provided');
  }
  if (p.weightKg !== undefined && !isNonNegative(p.weightKg)) {
    errors.push('familyProfile.weightKg must be >= 0 when provided');
  }
  if (p.birthDate !== undefined && !isIsoDate(p.birthDate)) {
    errors.push('familyProfile.birthDate must be YYYY-MM-DD when provided');
  }
  return fail(errors);
}

export function validateFoodSnapshot(
  snapshot: unknown,
  path = 'foodSnapshot',
): ValidationResult {
  const errors: string[] = [];
  const s = snapshot as Partial<FoodSnapshot>;
  if (!s || typeof s !== 'object') return fail([`${path} must be an object`]);
  if (!isNonEmptyString(s.name)) errors.push(`${path}.name is required`);
  if (!s.per100g) errors.push(`${path}.per100g is required`);
  else errors.push(...validateNutrition(s.per100g, `${path}.per100g`).errors);
  if (!s.source || !FOOD_SOURCES.includes(s.source)) {
    errors.push(`${path}.source must be one of ${FOOD_SOURCES.join(', ')}`);
  }
  if (!s.nutritionMeta || typeof s.nutritionMeta !== 'object') {
    errors.push(`${path}.nutritionMeta is required`);
  } else {
    const meta = s.nutritionMeta as Partial<NutritionDataMetadata>;
    if (!isNonEmptyString(meta.source)) {
      errors.push(`${path}.nutritionMeta.source must be a non-empty string`);
    }
    if (!isNonEmptyString(meta.version)) {
      errors.push(`${path}.nutritionMeta.version must be a non-empty string`);
    }
  }
  return fail(errors);
}

export function validateMealItem(item: unknown, index = 0): ValidationResult {
  const errors: string[] = [];
  const it = item as Partial<MealItem>;
  const at = `items[${index}]`;
  if (!it || typeof it !== 'object') return fail([`${at} must be an object`]);
  if (!isNonEmptyString(it.foodName)) errors.push(`${at}.foodName is required`);
  if (!it.foodSnapshot) errors.push(`${at}.foodSnapshot is required`);
  else errors.push(...validateFoodSnapshot(it.foodSnapshot, `${at}.foodSnapshot`).errors);
  if (!isNonNegative(it.quantity)) errors.push(`${at}.quantity must be >= 0`);
  if (!isNonEmptyString(it.portionLabel)) errors.push(`${at}.portionLabel is required`);
  if (!isFiniteNumber(it.portionGramsPerUnit) || (it.portionGramsPerUnit as number) <= 0) {
    errors.push(`${at}.portionGramsPerUnit must be a number > 0`);
  }
  if (!isNonNegative(it.grams)) errors.push(`${at}.grams must be >= 0`);
  if (!it.source || !ITEM_SOURCES.includes(it.source)) {
    errors.push(`${at}.source must be one of ${ITEM_SOURCES.join(', ')}`);
  }
  if (typeof it.confirmed !== 'boolean') errors.push(`${at}.confirmed must be a boolean`);
  if (!it.nutrition) errors.push(`${at}.nutrition is required`);
  else errors.push(...validateNutrition(it.nutrition, `${at}.nutrition`).errors);
  return fail(errors);
}

export function validateMeal(meal: unknown): ValidationResult {
  const errors: string[] = [];
  const m = meal as Partial<Meal>;
  if (!m || typeof m !== 'object') return fail(['meal must be an object']);
  if (!isNonEmptyString(m.ownerOpenid)) errors.push('meal.ownerOpenid is required');
  if (!isNonEmptyString(m.requestId)) errors.push('meal.requestId is required');
  if (!isNonEmptyString(m.familyProfileId)) errors.push('meal.familyProfileId is required');
  if (!isIsoDate(m.date)) errors.push('meal.date must be YYYY-MM-DD');
  if (!m.mealType || !MEAL_TYPES.includes(m.mealType)) {
    errors.push(`meal.mealType must be one of ${MEAL_TYPES.join(', ')}`);
  }
  if (!m.source || !RECORD_SOURCES.includes(m.source)) {
    errors.push(`meal.source must be one of ${RECORD_SOURCES.join(', ')}`);
  }
  if (!Array.isArray(m.items)) errors.push('meal.items must be an array');
  else m.items.forEach((it, i) => errors.push(...validateMealItem(it, i).errors));
  if (!m.totals) errors.push('meal.totals is required');
  else errors.push(...validateNutrition(m.totals, 'meal.totals').errors);
  return fail(errors);
}

export function validateRecipe(recipe: unknown): ValidationResult {
  const errors: string[] = [];
  const r = recipe as Partial<Recipe>;
  if (!r || typeof r !== 'object') return fail(['recipe must be an object']);
  if (!isNonEmptyString(r.ownerOpenid)) errors.push('recipe.ownerOpenid is required');
  if (!isNonEmptyString(r.name)) errors.push('recipe.name is required');
  if (!isFiniteNumber(r.servings) || (r.servings as number) <= 0) {
    errors.push('recipe.servings must be a number > 0');
  }
  if (!Array.isArray(r.ingredients) || r.ingredients.length === 0) {
    errors.push('recipe.ingredients must be a non-empty array');
  } else {
    r.ingredients.forEach((ing, i) => {
      if (!isNonEmptyString(ing.foodName)) errors.push(`recipe.ingredients[${i}].foodName is required`);
      if (!isNonNegative(ing.grams)) errors.push(`recipe.ingredients[${i}].grams must be >= 0`);
    });
  }
  return fail(errors);
}

export { ok };
