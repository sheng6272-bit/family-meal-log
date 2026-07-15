import {
  AI_ANALYSIS_STATUSES,
  FAMILY_RELATIONS,
  FOOD_SOURCES,
  ITEM_SOURCES,
  MEAL_TYPES,
  RECORD_SOURCES,
} from './constants';
import type {
  AiAnalysis,
  AiFoodSuggestion,
  FamilyProfile,
  Food,
  FoodSnapshot,
  Meal,
  MealItem,
  NutritionDataMetadata,
  NutritionValues,
  PortionUnit,
  Recipe,
  RecipeIngredient,
} from './types';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

function fail(errors: string[]): ValidationResult {
  return { valid: errors.length === 0, errors };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNonNegative(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && DATE_RE.test(value);
}

export function validateNutrition(value: unknown, path = 'nutrition'): ValidationResult {
  const errors: string[] = [];
  const nutrition = value as Partial<NutritionValues>;
  if (!nutrition || typeof nutrition !== 'object') return fail([`${path} must be an object`]);
  for (const key of ['calories', 'protein', 'carb', 'fat'] as const) {
    if (!isNonNegative(nutrition[key])) {
      errors.push(`${path}.${key} must be a number >= 0`);
    }
  }
  return fail(errors);
}

function validateNutritionMeta(
  value: unknown,
  path: string,
): ValidationResult {
  const errors: string[] = [];
  const meta = value as Partial<NutritionDataMetadata>;
  if (!meta || typeof meta !== 'object') return fail([`${path} must be an object`]);
  if (!isNonEmptyString(meta.source)) errors.push(`${path}.source must be a non-empty string`);
  if (!isNonEmptyString(meta.version)) errors.push(`${path}.version must be a non-empty string`);
  return fail(errors);
}

export function validateFood(value: unknown): ValidationResult {
  const errors: string[] = [];
  const food = value as Partial<Food>;
  if (!food || typeof food !== 'object') return fail(['food must be an object']);
  if (!isNonEmptyString(food.name)) errors.push('food.name is required');
  if (food.brand !== undefined && typeof food.brand !== 'string') errors.push('food.brand must be a string when provided');
  if (food.category !== undefined && typeof food.category !== 'string') errors.push('food.category must be a string when provided');
  if (!food.per100g) errors.push('food.per100g is required');
  else errors.push(...validateNutrition(food.per100g, 'food.per100g').errors);
  if (!food.source || !FOOD_SOURCES.includes(food.source)) {
    errors.push(`food.source must be one of ${FOOD_SOURCES.join(', ')}`);
  }
  if (typeof food.isSaved !== 'boolean') errors.push('food.isSaved must be a boolean');
  if (food.linkedFoodId !== undefined && !isNonEmptyString(food.linkedFoodId)) {
    errors.push('food.linkedFoodId must be a non-empty string when provided');
  }
  errors.push(...validateNutritionMeta(food.nutritionMeta, 'food.nutritionMeta').errors);
  return fail(errors);
}

export function validateFoodSnapshot(value: unknown, path = 'foodSnapshot'): ValidationResult {
  const errors: string[] = [];
  const snapshot = value as Partial<FoodSnapshot>;
  if (!snapshot || typeof snapshot !== 'object') return fail([`${path} must be an object`]);
  if (!isNonEmptyString(snapshot.name)) errors.push(`${path}.name is required`);
  if (!snapshot.per100g) errors.push(`${path}.per100g is required`);
  else errors.push(...validateNutrition(snapshot.per100g, `${path}.per100g`).errors);
  if (!snapshot.source || !FOOD_SOURCES.includes(snapshot.source)) {
    errors.push(`${path}.source must be one of ${FOOD_SOURCES.join(', ')}`);
  }
  if (snapshot.linkedFoodId !== undefined && !isNonEmptyString(snapshot.linkedFoodId)) {
    errors.push(`${path}.linkedFoodId must be a non-empty string when provided`);
  }
  errors.push(...validateNutritionMeta(snapshot.nutritionMeta, `${path}.nutritionMeta`).errors);
  return fail(errors);
}

export function validatePortionUnit(value: unknown): ValidationResult {
  const errors: string[] = [];
  const unit = value as Partial<PortionUnit>;
  if (!unit || typeof unit !== 'object') return fail(['portionUnit must be an object']);
  if (!isNonEmptyString(unit.label)) errors.push('portionUnit.label is required');
  if (!isFiniteNumber(unit.gramsPerUnit) || unit.gramsPerUnit <= 0) {
    errors.push('portionUnit.gramsPerUnit must be a number > 0');
  }
  return fail(errors);
}

export function validateFamilyProfile(value: unknown): ValidationResult {
  const errors: string[] = [];
  const profile = value as Partial<FamilyProfile>;
  if (!profile || typeof profile !== 'object') return fail(['familyProfile must be an object']);
  if (!isNonEmptyString(profile.ownerOpenid)) errors.push('familyProfile.ownerOpenid is required');
  if (!isNonEmptyString(profile.name)) errors.push('familyProfile.name is required');
  if (!profile.relation || !FAMILY_RELATIONS.includes(profile.relation)) {
    errors.push(`familyProfile.relation must be one of ${FAMILY_RELATIONS.join(', ')}`);
  }
  if (profile.birthDate !== undefined && !isIsoDate(profile.birthDate)) {
    errors.push('familyProfile.birthDate must be YYYY-MM-DD when provided');
  }
  if (profile.heightCm !== undefined && !isNonNegative(profile.heightCm)) {
    errors.push('familyProfile.heightCm must be >= 0 when provided');
  }
  if (profile.weightKg !== undefined && !isNonNegative(profile.weightKg)) {
    errors.push('familyProfile.weightKg must be >= 0 when provided');
  }
  return fail(errors);
}

export function validateMealItem(value: unknown, index = 0): ValidationResult {
  const errors: string[] = [];
  const item = value as Partial<MealItem>;
  const at = `items[${index}]`;
  if (!item || typeof item !== 'object') return fail([`${at} must be an object`]);
  if (!isNonEmptyString(item.foodName)) errors.push(`${at}.foodName is required`);
  errors.push(...validateFoodSnapshot(item.foodSnapshot, `${at}.foodSnapshot`).errors);
  if (!isFiniteNumber(item.quantity) || item.quantity <= 0) errors.push(`${at}.quantity must be > 0`);
  if (!isNonEmptyString(item.portionLabel)) errors.push(`${at}.portionLabel is required`);
  if (!isFiniteNumber(item.portionGramsPerUnit) || item.portionGramsPerUnit <= 0) {
    errors.push(`${at}.portionGramsPerUnit must be a number > 0`);
  }
  if (!isNonNegative(item.grams)) errors.push(`${at}.grams must be >= 0`);
  errors.push(...validateNutrition(item.nutrition, `${at}.nutrition`).errors);
  if (!item.source || !ITEM_SOURCES.includes(item.source)) {
    errors.push(`${at}.source must be one of ${ITEM_SOURCES.join(', ')}`);
  }
  if (typeof item.confirmed !== 'boolean') errors.push(`${at}.confirmed must be a boolean`);
  return fail(errors);
}

export function validateMeal(value: unknown): ValidationResult {
  const errors: string[] = [];
  const meal = value as Partial<Meal>;
  if (!meal || typeof meal !== 'object') return fail(['meal must be an object']);
  if (!isNonEmptyString(meal.ownerOpenid)) errors.push('meal.ownerOpenid is required');
  if (!isNonEmptyString(meal.requestId)) errors.push('meal.requestId is required');
  if (!isNonEmptyString(meal.familyProfileId)) errors.push('meal.familyProfileId is required');
  if (!isIsoDate(meal.date)) errors.push('meal.date must be YYYY-MM-DD');
  if (!meal.mealType || !MEAL_TYPES.includes(meal.mealType)) {
    errors.push(`meal.mealType must be one of ${MEAL_TYPES.join(', ')}`);
  }
  if (!meal.source || !RECORD_SOURCES.includes(meal.source)) {
    errors.push(`meal.source must be one of ${RECORD_SOURCES.join(', ')}`);
  }
  if (meal.note !== undefined && typeof meal.note !== 'string') {
    errors.push('meal.note must be a string when provided');
  }
  if (meal.photoFileId !== undefined && !isNonEmptyString(meal.photoFileId)) {
    errors.push('meal.photoFileId must be a non-empty string when provided');
  }
  if (meal.aiAnalysisId !== undefined && !isNonEmptyString(meal.aiAnalysisId)) {
    errors.push('meal.aiAnalysisId must be a non-empty string when provided');
  }
  if (!Array.isArray(meal.items) || meal.items.length === 0) {
    errors.push('meal.items must be a non-empty array');
  } else {
    meal.items.forEach((item, index) => errors.push(...validateMealItem(item, index).errors));
  }
  errors.push(...validateNutrition(meal.totals, 'meal.totals').errors);
  return fail(errors);
}

export function validateRecipeIngredient(value: unknown, index = 0): ValidationResult {
  const errors: string[] = [];
  const ingredient = value as Partial<RecipeIngredient>;
  const at = `recipe.ingredients[${index}]`;
  if (!ingredient || typeof ingredient !== 'object') return fail([`${at} must be an object`]);
  if (!isNonEmptyString(ingredient.foodName)) errors.push(`${at}.foodName is required`);
  if (!isFiniteNumber(ingredient.grams) || ingredient.grams <= 0) {
    errors.push(`${at}.grams must be > 0`);
  }
  errors.push(...validateFoodSnapshot(ingredient.foodSnapshot, `${at}.foodSnapshot`).errors);
  return fail(errors);
}

export function validateRecipe(value: unknown): ValidationResult {
  const errors: string[] = [];
  const recipe = value as Partial<Recipe>;
  if (!recipe || typeof recipe !== 'object') return fail(['recipe must be an object']);
  if (!isNonEmptyString(recipe.ownerOpenid)) errors.push('recipe.ownerOpenid is required');
  if (!isNonEmptyString(recipe.name)) errors.push('recipe.name is required');
  if (!isFiniteNumber(recipe.servings) || recipe.servings <= 0) {
    errors.push('recipe.servings must be a number > 0');
  }
  if (!isFiniteNumber(recipe.gramsPerServing) || recipe.gramsPerServing <= 0) {
    errors.push('recipe.gramsPerServing must be a number > 0');
  }
  if (!Array.isArray(recipe.ingredients) || recipe.ingredients.length === 0) {
    errors.push('recipe.ingredients must be a non-empty array');
  } else {
    recipe.ingredients.forEach((ingredient, index) => {
      errors.push(...validateRecipeIngredient(ingredient, index).errors);
    });
  }
  errors.push(...validateNutrition(recipe.perServing, 'recipe.perServing').errors);
  return fail(errors);
}

export function validateAiFoodSuggestion(value: unknown, index = 0): ValidationResult {
  const errors: string[] = [];
  const suggestion = value as Partial<AiFoodSuggestion>;
  const at = `suggestions[${index}]`;
  if (!suggestion || typeof suggestion !== 'object') return fail([`${at} must be an object`]);
  if (!isNonEmptyString(suggestion.foodName)) errors.push(`${at}.foodName is required`);
  if (!isFiniteNumber(suggestion.estimatedGrams) || suggestion.estimatedGrams <= 0) {
    errors.push(`${at}.estimatedGrams must be > 0`);
  }
  if (!isFiniteNumber(suggestion.confidence) || suggestion.confidence < 0 || suggestion.confidence > 1) {
    errors.push(`${at}.confidence must be between 0 and 1`);
  }
  if (suggestion.matchedFoodId !== undefined && !isNonEmptyString(suggestion.matchedFoodId)) {
    errors.push(`${at}.matchedFoodId must be a non-empty string when provided`);
  }
  if (suggestion.per100gGuess !== undefined) {
    errors.push(...validateNutrition(suggestion.per100gGuess, `${at}.per100gGuess`).errors);
  }
  return fail(errors);
}

export function validateAiAnalysis(value: unknown): ValidationResult {
  const errors: string[] = [];
  const analysis = value as Partial<AiAnalysis>;
  if (!analysis || typeof analysis !== 'object') return fail(['aiAnalysis must be an object']);
  if (!isNonEmptyString(analysis.ownerOpenid)) errors.push('aiAnalysis.ownerOpenid is required');
  if (!isNonEmptyString(analysis.photoFileId)) errors.push('aiAnalysis.photoFileId is required');
  if (analysis.mealId !== undefined && !isNonEmptyString(analysis.mealId)) {
    errors.push('aiAnalysis.mealId must be a non-empty string when provided');
  }
  if (!isNonEmptyString(analysis.provider)) errors.push('aiAnalysis.provider is required');
  if (!analysis.status || !AI_ANALYSIS_STATUSES.includes(analysis.status)) {
    errors.push(`aiAnalysis.status must be one of ${AI_ANALYSIS_STATUSES.join(', ')}`);
  }
  if (!Array.isArray(analysis.suggestions)) {
    errors.push('aiAnalysis.suggestions must be an array');
  } else {
    analysis.suggestions.forEach((suggestion, index) => {
      errors.push(...validateAiFoodSuggestion(suggestion, index).errors);
    });
  }
  return fail(errors);
}
