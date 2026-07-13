/**
 * Shared entity type definitions (schemas as TypeScript types).
 * Consumed by the Mini Program frontend and by CloudBase cloud functions.
 *
 * Storage note: `_id`, `_openid`, `createdAt`, `updatedAt` follow CloudBase
 * conventions. Timestamps are stored as epoch milliseconds (number) for
 * portability. Dates for grouping meals use `YYYY-MM-DD` strings.
 */

import type {
  MealType,
  RecordSource,
  ItemSource,
  FoodSource,
  FamilyRelation,
  AiAnalysisStatus,
} from './constants';

/** Per-serving / per-item nutrition values. Calories in kcal, macros in grams. */
export interface NutritionValues {
  calories: number; // kcal
  protein: number; // g
  carb: number; // g
  fat: number; // g
}

/** Nutrition density expressed per 100 grams of an edible food. */
export type NutritionPer100g = NutritionValues;

/** Common audit fields. */
export interface AuditFields {
  createdAt: number; // epoch ms
  updatedAt: number; // epoch ms
}

/** 1. WeChat-authenticated account. One per WeChat user. */
export interface User extends AuditFields {
  _id?: string;
  openid: string; // WeChat openid (server-derived, never trusted from client)
  unionid?: string;
  nickname?: string;
  defaultFamilyProfileId?: string;
}

/** 2. A family member the account owner logs meals for. */
export interface FamilyProfile extends AuditFields {
  _id?: string;
  ownerOpenid: string;
  name: string;
  relation: FamilyRelation;
  gender?: 'male' | 'female' | 'unspecified';
  birthDate?: string; // YYYY-MM-DD
  heightCm?: number;
  weightKg?: number;
  // NOTE: default-profile state is NOT stored here. The single source of truth
  // is `users.defaultFamilyProfileId`; `isDefault` is computed in the client
  // DTO only (see services/profile-service.ts#toClientProfile).
}

/**
 * Request-level idempotency record. Scoped by the trusted owner identity so a
 * repeated write (same `requestId`) returns the original result instead of
 * creating a duplicate. `name`/`relation` are never used as an idempotency key.
 */
export interface IdempotencyKey {
  _id?: string;
  ownerOpenid: string; // server-derived; never trusted from the client
  operation: string; // e.g. "create"
  requestId: string; // client-generated, high-entropy
  resultId: string; // id of the document the operation produced
  createdAt: number; // epoch ms
}

/** 3. A food definition with nutrition density. */
export interface Food extends AuditFields {
  _id?: string;
  name: string;
  brand?: string;
  category?: string;
  per100g: NutritionPer100g;
  source: FoodSource;
  ownerOpenid?: string; // present for user-saved/custom foods
  isSaved: boolean; // appears in the user's "saved foods" list
}

/** 4. A portion unit; may be generic or specific to a food. */
export interface PortionUnit extends AuditFields {
  _id?: string;
  label: string; // e.g. "碗", "个", "杯" (UI text) or "g"/"ml"
  gramsPerUnit: number; // gram equivalent of one unit
  foodId?: string; // when set, this unit only applies to that food
  isDefault?: boolean;
}

/** 6. A single line item inside a meal. Nutrition is snapshotted at save time. */
export interface MealItem {
  foodId?: string; // reference to a Food (optional for ad-hoc entries)
  foodName: string; // denormalized snapshot for stable history
  quantity: number; // number of portion units
  portionUnitId?: string;
  portionLabel: string; // snapshot, e.g. "碗"
  grams: number; // resolved gram weight (quantity * gramsPerUnit)
  nutrition: NutritionValues; // snapshot scaled to `grams`
  source: ItemSource;
  confirmed: boolean; // AI suggestions must be user-confirmed before counting
}

/** 5. A logged meal for one family profile on one date/slot. */
export interface Meal extends AuditFields {
  _id?: string;
  ownerOpenid: string;
  familyProfileId: string;
  date: string; // YYYY-MM-DD (local day the meal belongs to)
  mealType: MealType;
  items: MealItem[];
  totals: NutritionValues; // sum of confirmed items
  photoFileId?: string; // CloudBase storage fileID for the meal photo
  note?: string;
  source: RecordSource;
}

/** 7. Ingredient reference inside a recipe. */
export interface RecipeIngredient {
  foodId?: string;
  foodName: string;
  grams: number;
}

/** 7. A simple family recipe that resolves to nutrition per serving. */
export interface Recipe extends AuditFields {
  _id?: string;
  ownerOpenid: string;
  name: string;
  servings: number;
  ingredients: RecipeIngredient[];
  perServing: NutritionValues; // computed
}

/** 8. One AI food suggestion for a photo (never authoritative). */
export interface AiFoodSuggestion {
  foodName: string;
  estimatedGrams: number;
  confidence: number; // 0..1
  per100gGuess?: NutritionPer100g;
  matchedFoodId?: string; // when the suggestion maps to a known Food
}

/** 8. Result envelope for a photo analysis request. */
export interface AiAnalysis extends AuditFields {
  _id?: string;
  ownerOpenid: string;
  mealId?: string;
  photoFileId: string;
  provider: string; // "mock" | future providers
  status: AiAnalysisStatus;
  suggestions: AiFoodSuggestion[];
  errorMessage?: string;
}

/** Provider-neutral contract every AI provider adapter must satisfy. */
export interface AiAnalysisRequest {
  photoFileId: string;
  ownerOpenid: string;
  hintMealType?: MealType;
}

export interface AiAnalysisResult {
  provider: string;
  status: AiAnalysisStatus;
  suggestions: AiFoodSuggestion[];
  errorMessage?: string;
}
