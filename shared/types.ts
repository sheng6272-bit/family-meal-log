import type {
  MealType,
  RecordSource,
  ItemSource,
  FoodSource,
  FamilyRelation,
  AiAnalysisStatus,
} from './constants';

export interface NutritionValues {
  calories: number;
  protein: number;
  carb: number;
  fat: number;
}

export interface NutritionDataMetadata {
  source: string;
  version: string;
}

export type NutritionPer100g = NutritionValues;

export interface AuditFields {
  createdAt: number;
  updatedAt: number;
}

export interface User extends AuditFields {
  _id?: string;
  openid: string;
  unionid?: string;
  nickname?: string;
  defaultFamilyProfileId?: string;
}

export interface FamilyProfile extends AuditFields {
  _id?: string;
  ownerOpenid: string;
  name: string;
  relation: FamilyRelation;
  gender?: 'male' | 'female' | 'unspecified';
  birthDate?: string;
  heightCm?: number;
  weightKg?: number;
}

export interface IdempotencyKey {
  _id?: string;
  ownerOpenid: string;
  operation: string;
  requestId: string;
  resultId: string;
  createdAt: number;
}

export interface Food extends AuditFields {
  _id?: string;
  name: string;
  brand?: string;
  category?: string;
  per100g: NutritionPer100g;
  source: FoodSource;
  ownerOpenid?: string;
  isSaved: boolean;
  linkedFoodId?: string;
  nutritionMeta: NutritionDataMetadata;
}

export interface FoodSnapshot {
  foodId?: string;
  linkedFoodId?: string;
  name: string;
  brand?: string;
  category?: string;
  per100g: NutritionPer100g;
  source: FoodSource;
  nutritionMeta: NutritionDataMetadata;
}

export interface PortionUnit extends AuditFields {
  _id?: string;
  label: string;
  gramsPerUnit: number;
  foodId?: string;
  isDefault?: boolean;
}

export interface MealItem {
  foodId?: string;
  foodName: string;
  foodSnapshot: FoodSnapshot;
  quantity: number;
  portionUnitId?: string;
  portionLabel: string;
  portionGramsPerUnit: number;
  grams: number;
  nutrition: NutritionValues;
  source: ItemSource;
  confirmed: boolean;
}

export interface Meal extends AuditFields {
  _id?: string;
  ownerOpenid: string;
  requestId: string;
  familyProfileId: string;
  date: string;
  mealType: MealType;
  items: MealItem[];
  totals: NutritionValues;
  photoFileId?: string;
  note?: string;
  aiAnalysisId?: string;
  source: RecordSource;
}

export interface RecipeIngredient {
  foodId?: string;
  foodName: string;
  foodSnapshot: FoodSnapshot;
  grams: number;
}

export interface Recipe extends AuditFields {
  _id?: string;
  ownerOpenid: string;
  name: string;
  servings: number;
  gramsPerServing: number;
  ingredients: RecipeIngredient[];
  perServing: NutritionValues;
}

export interface AiFoodSuggestion {
  foodName: string;
  estimatedGrams: number;
  confidence: number;
  per100gGuess?: NutritionPer100g;
  matchedFoodId?: string;
}

export interface AiAnalysis extends AuditFields {
  _id?: string;
  ownerOpenid: string;
  mealId?: string;
  photoFileId: string;
  provider: string;
  status: AiAnalysisStatus;
  suggestions: AiFoodSuggestion[];
  errorMessage?: string;
}

export interface AiAnalysisRequest {
  photoFileId: string;
  ownerOpenid: string;
  hintMealType?: MealType;
}

export interface AiAnalysisResult {
  analysisId?: string;
  provider: string;
  status: AiAnalysisStatus;
  suggestions: AiFoodSuggestion[];
  errorMessage?: string;
}
