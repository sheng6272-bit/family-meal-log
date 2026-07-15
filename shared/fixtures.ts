/**
 * Deterministic sample data used by the validation/test command and as seed
 * references. These are NOT production data and contain no secrets.
 */

import type { Food, FamilyProfile, Meal } from './types';
import { gramsFromPortion, scaleNutrition, sumNutrition } from './nutrition';

const NOW = 1_700_000_000_000;

export const sampleFoods: Food[] = [
  {
    _id: 'sample_rice',
    name: 'Steamed rice',
    per100g: { calories: 130, protein: 2.7, carb: 28, fat: 0.3 },
    source: 'system',
    isSaved: true,
    nutritionMeta: { source: 'curated_mvp_seed', version: '1' },
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    _id: 'sample_chicken',
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

  const riceGrams = gramsFromPortion(1, 150);
  const chickenGrams = gramsFromPortion(2, 60);

  const riceNutrition = scaleNutrition(rice.per100g, riceGrams);
  const chickenNutrition = scaleNutrition(chicken.per100g, chickenGrams);

  const totals = sumNutrition([riceNutrition, chickenNutrition]);

  return {
    ownerOpenid: 'openid_demo_user',
    requestId: 'meal_req_demo',
    familyProfileId: 'profile_demo',
    date: '2026-07-13',
    mealType: 'lunch',
    source: 'manual',
    items: [
      {
        foodId: rice._id,
        foodName: rice.name,
        foodSnapshot: {
          foodId: rice._id,
          name: rice.name,
          brand: rice.brand,
          category: rice.category,
          per100g: rice.per100g,
          source: rice.source,
          nutritionMeta: rice.nutritionMeta,
        },
        quantity: 1,
        portionLabel: 'bowl',
        portionGramsPerUnit: 150,
        grams: riceGrams,
        nutrition: riceNutrition,
        source: 'manual',
        confirmed: true,
      },
      {
        foodId: chicken._id,
        foodName: chicken.name,
        foodSnapshot: {
          foodId: chicken._id,
          name: chicken.name,
          brand: chicken.brand,
          category: chicken.category,
          per100g: chicken.per100g,
          source: chicken.source,
          nutritionMeta: chicken.nutritionMeta,
        },
        quantity: 2,
        portionLabel: 'piece',
        portionGramsPerUnit: 60,
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
