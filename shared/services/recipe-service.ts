import type {
  Food,
  NutritionValues,
  PortionUnit,
  Recipe,
  RecipeIngredient,
} from '../types';
import type { Repository } from '../repository';
import { ServiceError } from '../repository';
import { roundNutrition, scaleNutrition, sumNutrition } from '../nutrition';
import { SYSTEM_FOODS } from '../data/system-foods';
import { createAdHocFood } from './food-catalog-service';

export interface RecipeIngredientInput {
  food?: unknown;
  grams?: unknown;
  [key: string]: unknown;
}

export interface RecipeInput {
  name?: unknown;
  servings?: unknown;
  ingredients?: unknown;
  [key: string]: unknown;
}

export interface ClientRecipe {
  _id: string;
  name: string;
  servings: number;
  gramsPerServing: number;
  ingredients: RecipeIngredient[];
  perServing: NutritionValues;
  createdAt: number;
  updatedAt: number;
}

type RecipeLike = Pick<
  Recipe,
  '_id' | 'name' | 'gramsPerServing' | 'perServing' | 'createdAt' | 'updatedAt'
>;

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function asNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ServiceError('validation', `${field} is required`);
  }
  return value.trim();
}

function asPositiveNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new ServiceError('validation', `${field} must be a finite number > 0`);
  }
  return value;
}

function findSystemFood(foodId: string | undefined): Food | undefined {
  if (!foodId) return undefined;
  return SYSTEM_FOODS.find((food) => food._id === foodId);
}

export function recipeToFood(recipe: RecipeLike): Food {
  const gramsPerServing = recipe.gramsPerServing;
  const factor = gramsPerServing > 0 ? 100 / gramsPerServing : 0;
  return {
    _id: recipe._id,
    name: recipe.name,
    category: '食谱',
    per100g: roundNutrition({
      calories: recipe.perServing.calories * factor,
      protein: recipe.perServing.protein * factor,
      carb: recipe.perServing.carb * factor,
      fat: recipe.perServing.fat * factor,
    }),
    source: 'recipe',
    isSaved: false,
    nutritionMeta: { source: 'recipe_computed', version: '1' },
    createdAt: recipe.createdAt,
    updatedAt: recipe.updatedAt,
  };
}

export function recipeToPortionUnit(recipe: RecipeLike): PortionUnit {
  const now = recipe.updatedAt || recipe.createdAt || Date.now();
  return {
    label: '1份',
    gramsPerUnit: recipe.gramsPerServing,
    foodId: recipe._id,
    isDefault: true,
    createdAt: now,
    updatedAt: now,
  };
}

function toClientRecipe(recipe: Recipe): ClientRecipe {
  return {
    _id: recipe._id as string,
    name: recipe.name,
    servings: recipe.servings,
    gramsPerServing: recipe.gramsPerServing,
    ingredients: recipe.ingredients,
    perServing: recipe.perServing,
    createdAt: recipe.createdAt,
    updatedAt: recipe.updatedAt,
  };
}

async function resolveIngredientFood(
  repo: Repository,
  openid: string,
  input: unknown,
  index: number,
): Promise<Food> {
  if (!input || typeof input !== 'object') {
    throw new ServiceError('validation', `ingredients[${index}].food must be an object`);
  }
  const source = input as {
    _id?: unknown;
    name?: unknown;
    brand?: unknown;
    category?: unknown;
    per100g?: unknown;
    calories?: unknown;
    protein?: unknown;
    carb?: unknown;
    fat?: unknown;
  };
  const foodId = typeof source._id === 'string' ? source._id : undefined;
  const systemFood = findSystemFood(foodId);
  if (systemFood) return systemFood;

  if (foodId) {
    const savedFood = await repo.getFood(foodId);
    if (savedFood) {
      if (savedFood.ownerOpenid !== openid) {
        throw new ServiceError('forbidden', 'ingredient food does not belong to caller');
      }
      const linked = findSystemFood(savedFood.linkedFoodId);
      return linked || savedFood;
    }

    const recipe = await repo.getRecipe(foodId);
    if (recipe) {
      if (recipe.ownerOpenid !== openid) {
        throw new ServiceError('forbidden', 'ingredient recipe does not belong to caller');
      }
      return recipeToFood(recipe);
    }
  }

  const per100g = source.per100g as Partial<NutritionValues> | undefined;
  return createAdHocFood({
    name: source.name,
    brand: source.brand,
    category: source.category,
    calories: per100g?.calories ?? source.calories,
    protein: per100g?.protein ?? source.protein,
    carb: per100g?.carb ?? source.carb,
    fat: per100g?.fat ?? source.fat,
  });
}

function toIngredient(food: Food, grams: number): RecipeIngredient {
  return {
    foodId: food._id,
    foodName: food.name,
    foodSnapshot: {
      foodId: food._id,
      linkedFoodId: food.linkedFoodId,
      name: food.name,
      brand: food.brand,
      category: food.category,
      per100g: food.per100g,
      source: food.source,
      nutritionMeta: food.nutritionMeta,
    },
    grams,
  };
}

async function normalizeIngredients(
  repo: Repository,
  openid: string,
  value: unknown,
): Promise<RecipeIngredient[]> {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ServiceError('validation', 'ingredients must be a non-empty array');
  }

  const ingredients: RecipeIngredient[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const raw = value[index];
    if (!raw || typeof raw !== 'object') {
      throw new ServiceError('validation', `ingredients[${index}] must be an object`);
    }
    const input = raw as RecipeIngredientInput;
    const food = await resolveIngredientFood(repo, openid, input.food, index);
    const grams = asPositiveNumber(input.grams, `ingredients[${index}].grams`);
    ingredients.push(toIngredient(food, grams));
  }
  return ingredients;
}

function computePerServing(
  ingredients: RecipeIngredient[],
  servings: number,
): { perServing: NutritionValues; gramsPerServing: number } {
  const totalNutrition = sumNutrition(
    ingredients.map((ingredient) =>
      scaleNutrition(ingredient.foodSnapshot.per100g, ingredient.grams),
    ),
  );
  const totalGrams = ingredients.reduce((sum, ingredient) => sum + ingredient.grams, 0);
  return {
    perServing: roundNutrition({
      calories: totalNutrition.calories / servings,
      protein: totalNutrition.protein / servings,
      carb: totalNutrition.carb / servings,
      fat: totalNutrition.fat / servings,
    }),
    gramsPerServing: round1(totalGrams / servings),
  };
}

export async function listRecipes(
  repo: Repository,
  openid: string,
): Promise<ClientRecipe[]> {
  if (!openid) throw new ServiceError('invalid_input', 'openid is required');
  const recipes = await repo.listRecipes(openid);
  return recipes
    .slice()
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map(toClientRecipe);
}

export async function getRecipe(
  repo: Repository,
  openid: string,
  recipeId: string,
): Promise<Recipe> {
  if (!openid) throw new ServiceError('invalid_input', 'openid is required');
  const recipe = await repo.getRecipe(recipeId);
  if (!recipe) throw new ServiceError('not_found', 'recipe not found');
  if (recipe.ownerOpenid !== openid) {
    throw new ServiceError('forbidden', 'recipe does not belong to caller');
  }
  return recipe;
}

export async function createRecipe(
  repo: Repository,
  openid: string,
  input: RecipeInput,
): Promise<ClientRecipe> {
  if (!openid) throw new ServiceError('invalid_input', 'openid is required');
  if (!input || typeof input !== 'object') {
    throw new ServiceError('validation', 'recipe input must be an object');
  }

  const name = asNonEmptyString(input.name, 'name');
  const servings = asPositiveNumber(input.servings, 'servings');
  const ingredients = await normalizeIngredients(repo, openid, input.ingredients);
  const computed = computePerServing(ingredients, servings);
  const now = Date.now();
  const recipe: Recipe = {
    ownerOpenid: openid,
    name,
    servings,
    gramsPerServing: computed.gramsPerServing,
    ingredients,
    perServing: computed.perServing,
    createdAt: now,
    updatedAt: now,
  };
  const created = await repo.createRecipe(recipe);
  return toClientRecipe(created);
}

export async function updateRecipe(
  repo: Repository,
  openid: string,
  recipeId: string,
  input: RecipeInput,
): Promise<ClientRecipe> {
  const current = await getRecipe(repo, openid, recipeId);
  const name = input.name === undefined ? current.name : asNonEmptyString(input.name, 'name');
  const servings =
    input.servings === undefined ? current.servings : asPositiveNumber(input.servings, 'servings');
  const ingredients =
    input.ingredients === undefined
      ? current.ingredients
      : await normalizeIngredients(repo, openid, input.ingredients);
  const computed = computePerServing(ingredients, servings);
  const updated = await repo.updateRecipe(recipeId, {
    ...current,
    name,
    servings,
    gramsPerServing: computed.gramsPerServing,
    ingredients,
    perServing: computed.perServing,
    updatedAt: Date.now(),
  });
  return toClientRecipe(updated);
}

export async function deleteRecipe(
  repo: Repository,
  openid: string,
  recipeId: string,
): Promise<void> {
  await getRecipe(repo, openid, recipeId);
  await repo.deleteRecipe(recipeId);
}

export { toClientRecipe };
