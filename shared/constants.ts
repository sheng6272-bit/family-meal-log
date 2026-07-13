/**
 * Shared constants and enumerations.
 * Single source of truth for both the Mini Program frontend and cloud functions.
 * All identifiers are in English; user-facing labels (Chinese) live in the UI layer.
 */

/** The four meal slots supported in v0.1. */
export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
export type MealType = (typeof MEAL_TYPES)[number];

/** Where a record originated. Manual is always the reliable primary path. */
export const RECORD_SOURCES = ['manual', 'ai_assisted'] as const;
export type RecordSource = (typeof RECORD_SOURCES)[number];

/** Provenance of a single meal item. */
export const ITEM_SOURCES = ['manual', 'ai_suggested'] as const;
export type ItemSource = (typeof ITEM_SOURCES)[number];

/** Where a food definition came from. */
export const FOOD_SOURCES = ['system', 'user', 'recipe'] as const;
export type FoodSource = (typeof FOOD_SOURCES)[number];

/** Relation of a family profile to the account owner. */
export const FAMILY_RELATIONS = ['self', 'spouse', 'child', 'parent', 'other'] as const;
export type FamilyRelation = (typeof FAMILY_RELATIONS)[number];

/** Lifecycle status of an AI analysis request. */
export const AI_ANALYSIS_STATUSES = ['pending', 'succeeded', 'failed'] as const;
export type AiAnalysisStatus = (typeof AI_ANALYSIS_STATUSES)[number];

/** Atomic energy units. Calories are kcal; macros are grams. */
export const KCAL_PER_GRAM = {
  protein: 4,
  carb: 4,
  fat: 9,
} as const;

/** CloudBase collection names (kept centralized so both layers agree). */
export const COLLECTIONS = {
  users: 'users',
  familyProfiles: 'family_profiles',
  foods: 'foods',
  portionUnits: 'portion_units',
  meals: 'meals',
  recipes: 'recipes',
  aiAnalyses: 'ai_analyses',
} as const;

/** Generic (food-independent) portion units always available in the UI. */
export const GENERIC_PORTION_UNITS = [
  { key: 'g', gramsPerUnit: 1 },
  { key: 'ml', gramsPerUnit: 1 }, // treated as 1g/ml approximation for water-like foods
] as const;
