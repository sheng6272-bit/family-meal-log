import type {
  AdHocFoodInput,
  ClientRecipe,
  Food,
  FoodPreview,
  NutritionValues,
  PortionUnit,
} from '@shared/index';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const shared = require('../lib/shared/index.js') as typeof import('@shared/index');

export type {
  AdHocFoodInput,
  ClientRecipe,
  Food,
  FoodPreview,
  NutritionValues,
  PortionUnit,
};

let sessionAdHocFoods: Food[] = [];
let sessionSavedFoods: Food[] = [];
let sessionRecipeFoods: Food[] = [];
let recipeUnitByFoodId: Record<string, PortionUnit> = {};

function dedupeFoods(foods: Food[]): Food[] {
  const seen = new Set<string>();
  const output: Food[] = [];
  foods.forEach((food) => {
    const key = food._id || `${food.source}:${food.name}`;
    if (seen.has(key)) return;
    seen.add(key);
    output.push(food);
  });
  return output;
}

export function getSystemFoods(): Food[] {
  return shared.SYSTEM_FOODS;
}

export function getSavedFoods(): Food[] {
  return sessionSavedFoods.slice();
}

export function getRecipeFoods(): Food[] {
  return sessionRecipeFoods.slice();
}

export function getAdHocFoods(): Food[] {
  return sessionAdHocFoods.slice();
}

export function resetAdHocFoods(): void {
  sessionAdHocFoods = [];
}

export function resetLibraryFoods(): void {
  sessionSavedFoods = [];
  sessionRecipeFoods = [];
  recipeUnitByFoodId = {};
}

export function setLibraryFoods(savedFoods: Food[], recipes: ClientRecipe[]): void {
  sessionSavedFoods = dedupeFoods(savedFoods.map((food) => ({ ...food })));
  sessionRecipeFoods = recipes.map((recipe) => shared.recipeToFood(recipe));
  recipeUnitByFoodId = {};
  recipes.forEach((recipe) => {
    if (recipe._id) {
      recipeUnitByFoodId[recipe._id] = shared.recipeToPortionUnit(recipe);
    }
  });
}

function combinedFoods(): Food[] {
  return dedupeFoods([
    ...shared.SYSTEM_FOODS,
    ...sessionSavedFoods,
    ...sessionRecipeFoods,
    ...sessionAdHocFoods,
  ]);
}

export function searchFoods(query: string): Food[] {
  return shared.searchFoods(combinedFoods(), query);
}

export function findFoodById(id: string | undefined): Food | undefined {
  if (!id) return undefined;
  return combinedFoods().find((food) => food._id === id);
}

export function getPortionUnits(food: Food | null | undefined): PortionUnit[] {
  if (!food) return [];
  if (food._id && recipeUnitByFoodId[food._id]) {
    return [recipeUnitByFoodId[food._id], ...shared.genericPortionUnits()];
  }
  return shared.getAvailablePortionUnits(
    food.linkedFoodId || food._id,
    shared.genericPortionUnits(),
    shared.SYSTEM_PORTION_UNITS,
  );
}

export function getDefaultPortionUnit(units: PortionUnit[]): PortionUnit | undefined {
  return shared.getDefaultPortionUnit(units);
}

export function computePreview(
  food: Food,
  unit: PortionUnit,
  quantity: number,
): FoodPreview {
  return shared.calculateFoodPreview(food, unit, quantity);
}

export function sumNutritionList(list: NutritionValues[]): NutritionValues {
  return shared.sumNutrition(list);
}

export function createAdHocFood(input: AdHocFoodInput): Food {
  const food = shared.createAdHocFood(input);
  sessionAdHocFoods = [...sessionAdHocFoods, food];
  return food;
}

export function toUserMessage(err: unknown): string {
  if (shared.isServiceError(err)) {
    if (err.code === 'validation') return err.message || '输入有误，请检查后重试。';
    if (err.code === 'forbidden') return '你没有权限使用这个内容。';
    if (err.code === 'not_found') return '没有找到对应的食品。';
    return '操作失败，请稍后重试。';
  }
  if (err instanceof Error) return err.message || '操作失败，请稍后重试。';
  return '操作失败，请稍后重试。';
}
