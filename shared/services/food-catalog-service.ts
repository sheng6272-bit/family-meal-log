/**
 * Food catalog service (M2). Pure, SDK-free helpers for searching foods,
 * building a single-food nutrition preview, and creating session-only ad-hoc
 * (user-entered) foods. None of these touch CloudBase or persist anything —
 * ad-hoc foods live only for the current session (see M2 scope boundary).
 */

import type { Food, PortionUnit, NutritionValues, NutritionPer100g } from '../types';
import { gramsFromPortion, scaleNutrition } from '../nutrition';
import { validateFood } from '../validation';
import { ServiceError } from '../repository';

/** Input for creating a user-defined ad-hoc food (session only, never saved). */
export interface AdHocFoodInput {
  name: unknown;
  brand?: unknown;
  category?: unknown;
  calories: unknown;
  protein: unknown;
  carb: unknown;
  fat: unknown;
  [key: string]: unknown; // extras are ignored (whitelist below)
}

/** Result of computing a single-food preview. */
export interface FoodPreview {
  food: Food;
  unit: PortionUnit;
  quantity: number;
  grams: number;
  nutrition: NutritionValues;
}

/**
 * Search a list of foods by a free-text query.
 * - trims and lower-cases the query
 * - empty query returns a stable copy of the whole list (no mutation)
 * - matches name / brand / category (case-insensitive, substring)
 * - preserves input order (deterministic)
 * - never mutates the input array
 */
export function searchFoods(foods: Food[], query: string): Food[] {
  const q = typeof query === 'string' ? query.trim().toLowerCase() : '';
  if (!q) return foods.slice();
  return foods.filter((f) => {
    const name = (f.name || '').toLowerCase();
    const brand = (f.brand || '').toLowerCase();
    const category = (f.category || '').toLowerCase();
    return name.includes(q) || brand.includes(q) || category.includes(q);
  });
}

/**
 * Compute a single-food nutrition preview.
 * Throws (via `gramsFromPortion` / `scaleNutrition`) on invalid quantity or
 * unit weight — callers should catch and surface a clear message. Does NOT
 * mutate `food` or `unit`.
 */
export function calculateFoodPreview(
  food: Food,
  unit: PortionUnit,
  quantity: number,
): FoodPreview {
  const grams = gramsFromPortion(quantity, unit.gramsPerUnit);
  const nutrition: NutritionValues = scaleNutrition(
    food.per100g as NutritionPer100g,
    grams,
  );
  return { food, unit, quantity, grams, nutrition };
}

function isFiniteNonNeg(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0;
}

/**
 * Build a session-only ad-hoc food from user input.
 * - name is trimmed; empty name is rejected
 * - per-100g calories/protein/carb/fat must each be a finite, non-negative number
 * - `source` is forced to `'user'`, `isSaved` to `false`
 * - `nutritionMeta.source` is forced to `'user_entered'`, `version` to `'1'`
 * - unknown fields (incl. any `ownerOpenid`) are dropped — we never accept or
 *   persist an owning identity from the client
 * - nothing is written to CloudBase; the returned object is usable immediately
 *   in the current session
 */
export function createAdHocFood(input: AdHocFoodInput): Food {
  if (!input || typeof input !== 'object') {
    throw new ServiceError('validation', '自定义食品输入无效');
  }
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!name) {
    throw new ServiceError('validation', '食品名称不能为空');
  }

  const fields: (keyof NutritionValues)[] = ['calories', 'protein', 'carb', 'fat'];
  const per100g: NutritionValues = { calories: 0, protein: 0, carb: 0, fat: 0 };
  for (const key of fields) {
    const v = input[key];
    if (!isFiniteNonNeg(v)) {
      throw new ServiceError('validation', `每 100g 的${key}必须为不小于 0 的数字`);
    }
    per100g[key] = v;
  }

  const brand = typeof input.brand === 'string' ? input.brand.trim() : '';
  const category = typeof input.category === 'string' ? input.category.trim() : '';

  const now = Date.now();
  const food: Food = {
    _id: `adhoc_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    name,
    brand: brand || undefined,
    category: category || undefined,
    per100g,
    source: 'user',
    isSaved: false,
    nutritionMeta: { source: 'user_entered', version: '1' },
    createdAt: now,
    updatedAt: now,
  };

  // Defensive: guarantee the produced object satisfies the shared validator.
  const v = validateFood(food);
  if (!v.valid) {
    throw new ServiceError('validation', v.errors.join('；'));
  }
  return food;
}
