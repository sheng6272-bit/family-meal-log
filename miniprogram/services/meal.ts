import { isCloudReady, callFunction } from './cloud';
import type {
  ClientMeal,
  ClientMealListResult,
  CreateMealInput,
  UpdateMealInput,
} from '@shared/index';

export type {
  ClientMeal,
  ClientMealListResult,
  CreateMealInput,
  UpdateMealInput,
} from '@shared/index';

interface MealResponse {
  ok: boolean;
  meal?: ClientMeal;
  meals?: ClientMeal[];
  totals?: ClientMealListResult['totals'];
  error?: string;
  message?: string;
}

function req<T>(action: string, data: Record<string, unknown> = {}): Promise<T> {
  if (!isCloudReady()) throw new Error('cloud_not_ready');
  return callFunction<T>('mealApi', { action, ...data });
}

export function newMealRequestId(): string {
  const rand = Math.random().toString(36).slice(2);
  const rand2 = Math.random().toString(36).slice(2);
  return `meal_${Date.now().toString(36)}_${rand}${rand2}`;
}

function toError(res: MealResponse, fallback: string): string {
  if (res.error === 'invalid_input') return `invalid_input:${res.message || ''}`;
  return res.error || fallback;
}

export async function createMeal(input: CreateMealInput): Promise<ClientMeal> {
  const res = await req<MealResponse>('create', input as Record<string, unknown>);
  if (!res.ok || !res.meal) throw new Error(toError(res, 'create_failed'));
  return res.meal;
}

export async function getMeal(mealId: string): Promise<ClientMeal> {
  const res = await req<MealResponse>('get', { mealId });
  if (!res.ok || !res.meal) throw new Error(toError(res, 'get_failed'));
  return res.meal;
}

export async function listMeals(
  familyProfileId: string,
  date: string,
): Promise<ClientMealListResult> {
  const res = await req<MealResponse>('list', { familyProfileId, date });
  if (!res.ok || !res.meals || !res.totals) {
    throw new Error(toError(res, 'list_failed'));
  }
  return { meals: res.meals, totals: res.totals };
}

export async function updateMeal(
  mealId: string,
  input: UpdateMealInput,
): Promise<ClientMeal> {
  const res = await req<MealResponse>('update', {
    mealId,
    ...(input as Record<string, unknown>),
  });
  if (!res.ok || !res.meal) throw new Error(toError(res, 'update_failed'));
  return res.meal;
}

export async function deleteMeal(mealId: string): Promise<void> {
  const res = await req<MealResponse>('delete', { mealId });
  if (!res.ok) throw new Error(toError(res, 'delete_failed'));
}

export function toUserMessage(err: unknown): string {
  if (!(err instanceof Error)) return '保存失败，请稍后重试。';
  if (err.message.startsWith('invalid_input:')) {
    return err.message.replace(/^invalid_input:/, '') || '输入有误，请检查后重试。';
  }
  if (err.message === 'cloud_not_ready') return '云开发尚未就绪，请稍后重试。';
  if (err.message === 'forbidden') return '你没有权限访问这条餐食记录。';
  if (err.message === 'not_found') return '没有找到这条餐食记录。';
  return '操作失败，请稍后重试。';
}
