import { isCloudReady, callFunction } from './cloud';
import type {
  ClientMeal,
  CreateMealInput,
} from '@shared/index';

export type { ClientMeal, CreateMealInput } from '@shared/index';

export interface MealCreateResult {
  meal: ClientMeal;
}

interface MealResponse {
  ok: boolean;
  meal?: ClientMeal;
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

export async function createMeal(input: CreateMealInput): Promise<ClientMeal> {
  const res = await req<MealResponse>('create', input as Record<string, unknown>);
  if (!res.ok || !res.meal) {
    throw new Error(toError(res, 'create_failed'));
  }
  return res.meal;
}

export async function getMeal(mealId: string): Promise<ClientMeal> {
  const res = await req<MealResponse>('get', { mealId });
  if (!res.ok || !res.meal) {
    throw new Error(toError(res, 'get_failed'));
  }
  return res.meal;
}

function toError(res: MealResponse, fallback: string): string {
  if (res.error === 'invalid_input') return `invalid_input:${res.message || ''}`;
  return res.error || fallback;
}

export function toUserMessage(err: unknown): string {
  if (!(err instanceof Error)) return '保存失败，请稍后重试';
  if (err.message.startsWith('invalid_input:')) {
    return err.message.replace(/^invalid_input:/, '') || '输入无效，请检查后重试';
  }
  if (err.message === 'cloud_not_ready') return '当前离线，无法保存到云端';
  if (err.message === 'forbidden') return '当前成员不属于此账号';
  if (err.message === 'not_found') return '未找到对应的餐食或成员';
  return '保存失败，请稍后重试';
}
