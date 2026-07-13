/**
 * Nutrition calculation layer.
 *
 * IMPORTANT ARCHITECTURE RULE:
 * This module is the single source of nutritional truth. It is intentionally
 * PURE and has NO dependency on any AI code. AI suggestions may *propose*
 * grams/foods, but every number a user sees is computed here from confirmed,
 * user-editable inputs.
 */

import { KCAL_PER_GRAM } from './constants';
import type { NutritionValues, NutritionPer100g } from './types';

/** An empty nutrition accumulator. */
export function emptyNutrition(): NutritionValues {
  return { calories: 0, protein: 0, carb: 0, fat: 0 };
}

/** Round a nutrition value set to one decimal place for stable display/storage. */
export function roundNutrition(n: NutritionValues): NutritionValues {
  const r = (v: number) => Math.round(v * 10) / 10;
  return { calories: r(n.calories), protein: r(n.protein), carb: r(n.carb), fat: r(n.fat) };
}

/**
 * Convert a quantity of portion units into grams.
 * grams = quantity * gramsPerUnit
 */
export function gramsFromPortion(quantity: number, gramsPerUnit: number): number {
  if (!Number.isFinite(quantity) || !Number.isFinite(gramsPerUnit)) {
    throw new Error('gramsFromPortion: quantity and gramsPerUnit must be finite numbers');
  }
  if (quantity < 0 || gramsPerUnit <= 0) {
    throw new Error('gramsFromPortion: quantity must be >= 0 and gramsPerUnit must be > 0');
  }
  return quantity * gramsPerUnit;
}

/** Scale a per-100g nutrition density to an arbitrary gram weight. */
export function scaleNutrition(per100g: NutritionPer100g, grams: number): NutritionValues {
  if (grams < 0 || !Number.isFinite(grams)) {
    throw new Error('scaleNutrition: grams must be a finite number >= 0');
  }
  const factor = grams / 100;
  return roundNutrition({
    calories: per100g.calories * factor,
    protein: per100g.protein * factor,
    carb: per100g.carb * factor,
    fat: per100g.fat * factor,
  });
}

/** Sum an arbitrary list of nutrition values. */
export function sumNutrition(list: NutritionValues[]): NutritionValues {
  const total = list.reduce((acc, n) => {
    acc.calories += n.calories;
    acc.protein += n.protein;
    acc.carb += n.carb;
    acc.fat += n.fat;
    return acc;
  }, emptyNutrition());
  return roundNutrition(total);
}

/**
 * Compute calories implied by macros using the Atwater 4/4/9 factors.
 * Used as an internal consistency check, not as the displayed calorie value.
 */
export function caloriesFromMacros(protein: number, carb: number, fat: number): number {
  return (
    protein * KCAL_PER_GRAM.protein + carb * KCAL_PER_GRAM.carb + fat * KCAL_PER_GRAM.fat
  );
}

/**
 * Whether a food's declared calories are broadly consistent with its macros.
 * Real foods include fibre/alcohol/rounding, so we allow a tolerance band.
 */
export function isCalorieMacroConsistent(
  n: NutritionValues,
  toleranceRatio = 0.25,
): boolean {
  const implied = caloriesFromMacros(n.protein, n.carb, n.fat);
  if (n.calories === 0 && implied === 0) return true;
  const denom = Math.max(n.calories, implied, 1);
  return Math.abs(n.calories - implied) / denom <= toleranceRatio;
}
