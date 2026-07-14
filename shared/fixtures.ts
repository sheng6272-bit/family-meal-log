/**
 * Deterministic sample data used by the validation/test command and as seed
 * references. These are NOT production data and contain no secrets.
 */

import type { Food, FamilyProfile, Meal } from './types';
import { gramsFromPortion, scaleNutrition, sumNutrition } from './nutrition';

const NOW = 1_700_000_000_000;

export const sampleFoods: Food[] = [
  {
    name: 'Steamed rice',
    per100g: { calories: 130, protein: 2.7, carb: 28, fat: 0.3 },
    source: 'system',
    isSaved: true,
    nutritionMeta: { source: 'curated_mvp_seed', version: '1' },
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    name: 'Chicken breast',
    per100g: { calories: 165, protein: 31, carb: 0, fat: 3.6 },
    source: 'system',
    isSaved: true,
    nutritionMeta: { source: 'curated_mvp_seed', version: '1' },
    createdAt: NOW,
    updatedAt: NOW,
  },
];

export const sampleFamilyProfile: FamilyProfile = {
  ownerOpenid: 'openid_demo_user',
  name: '爸爸',
  relation: 'self',
  gender: 'male',
  createdAt: NOW,
  updatedAt: NOW,
};

/**
 * Build a fully-computed sample meal using ONLY the nutrition layer, proving
 * portion->gram conversion and scaling produce consistent totals.
 */
export function buildSampleMeal(): Meal {
  const rice = sampleFoods[0];
  const chicken = sampleFoods[1];

  const riceGrams = gramsFromPortion(1, 150); // 1 碗 = 150g
  const chickenGrams = gramsFromPortion(2, 60); // 2 块 = 120g

  const riceNutrition = scaleNutrition(rice.per100g, riceGrams);
  const chickenNutrition = scaleNutrition(chicken.per100g, chickenGrams);

  const totals = sumNutrition([riceNutrition, chickenNutrition]);

  return {
    ownerOpenid: 'openid_demo_user',
    familyProfileId: 'profile_demo',
    date: '2026-07-13',
    mealType: 'lunch',
    source: 'manual',
    items: [
      {
        foodName: rice.name,
        quantity: 1,
        portionLabel: '碗',
        grams: riceGrams,
        nutrition: riceNutrition,
        source: 'manual',
        confirmed: true,
      },
      {
        foodName: chicken.name,
        quantity: 2,
        portionLabel: '块',
        grams: chickenGrams,
        nutrition: chickenNutrition,
        source: 'manual',
        confirmed: true,
      },
    ],
    totals,
    createdAt: NOW,
    updatedAt: NOW,
  };
}
