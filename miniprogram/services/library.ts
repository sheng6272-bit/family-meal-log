import { isCloudReady, callFunction } from './cloud';
import type { ClientFood, ClientRecipe, Food, RecipeInput } from '@shared/index';

export type { ClientFood, ClientRecipe, Food, RecipeInput } from '@shared/index';

interface LibraryResponse {
  ok: boolean;
  savedFoods?: ClientFood[];
  recipes?: ClientRecipe[];
  food?: ClientFood;
  recipe?: ClientRecipe;
  error?: string;
  message?: string;
}

export interface LibraryResult {
  savedFoods: ClientFood[];
  recipes: ClientRecipe[];
}

function req<T>(action: string, data: Record<string, unknown> = {}): Promise<T> {
  if (!isCloudReady()) throw new Error('cloud_not_ready');
  return callFunction<T>('mealApi', { action, ...data });
}

function toError(res: LibraryResponse, fallback: string): string {
  if (res.error === 'invalid_input') return `invalid_input:${res.message || ''}`;
  return res.error || fallback;
}

export async function listLibrary(): Promise<LibraryResult> {
  const res = await req<LibraryResponse>('listLibrary');
  if (!res.ok || !res.savedFoods || !res.recipes) {
    throw new Error(toError(res, 'library_failed'));
  }
  return { savedFoods: res.savedFoods, recipes: res.recipes };
}

export async function saveFood(food: Food): Promise<ClientFood> {
  const res = await req<LibraryResponse>('saveFood', { food });
  if (!res.ok || !res.food) throw new Error(toError(res, 'save_food_failed'));
  return res.food;
}

export async function deleteSavedFood(foodId: string): Promise<void> {
  const res = await req<LibraryResponse>('deleteSavedFood', { foodId });
  if (!res.ok) throw new Error(toError(res, 'delete_saved_food_failed'));
}

export async function createRecipe(input: RecipeInput): Promise<ClientRecipe> {
  const res = await req<LibraryResponse>('createRecipe', input as Record<string, unknown>);
  if (!res.ok || !res.recipe) throw new Error(toError(res, 'create_recipe_failed'));
  return res.recipe;
}

export async function updateRecipe(
  recipeId: string,
  input: RecipeInput,
): Promise<ClientRecipe> {
  const res = await req<LibraryResponse>('updateRecipe', {
    recipeId,
    ...(input as Record<string, unknown>),
  });
  if (!res.ok || !res.recipe) throw new Error(toError(res, 'update_recipe_failed'));
  return res.recipe;
}

export async function deleteRecipe(recipeId: string): Promise<void> {
  const res = await req<LibraryResponse>('deleteRecipe', { recipeId });
  if (!res.ok) throw new Error(toError(res, 'delete_recipe_failed'));
}

export function toUserMessage(err: unknown): string {
  if (!(err instanceof Error)) return '操作失败，请稍后重试。';
  if (err.message.startsWith('invalid_input:')) {
    return err.message.replace(/^invalid_input:/, '') || '输入有误，请检查后重试。';
  }
  if (err.message === 'cloud_not_ready') return '云开发尚未就绪，请稍后重试。';
  if (err.message === 'forbidden') return '你没有权限操作这些收藏或食谱。';
  if (err.message === 'not_found') return '目标内容不存在或已被删除。';
  return '操作失败，请稍后重试。';
}
