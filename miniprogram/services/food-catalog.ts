/**
 * Client food-catalog service (M2).
 *
 * Wraps the SHARED runtime that is generated into `miniprogram/lib/shared/` by
 * `npm run build:shared` (see scripts/build-shared.mjs). We load it via a
 * runtime `require` (not an `import`) so:
 *  - the SAME validators / calculation live in one place (the shared layer);
 *  - the client never re-implements nutrition math or search logic;
 *  - type information is still available via `import type` from `@shared/*`.
 *
 * This service deliberately does NOT:
 *  - call `mealApi` or write any `meals` record (meal persistence is M3);
 *  - write to CloudBase or the `foods` collection;
 *  - touch openid / cloud identity;
 *  - depend on any AI code.
 *
 * Ad-hoc (user-entered) foods are kept in module memory ONLY for the current
 * session — they are never persisted and never uploaded.
 */

import type {
  Food,
  PortionUnit,
  NutritionValues,
  FoodPreview,
  AdHocFoodInput,
} from '@shared/index';

// Runtime load of the shared CommonJS build. Typed via the source module.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const shared = require('../lib/shared/index.js') as typeof import('@shared/index');

export type { Food, PortionUnit, NutritionValues, FoodPreview, AdHocFoodInput };

// Session-only ad-hoc foods (NOT persisted anywhere).
let sessionAdHocFoods: Food[] = [];

export function getSystemFoods(): Food[] {
  return shared.SYSTEM_FOODS;
}

export function getAdHocFoods(): Food[] {
  return sessionAdHocFoods;
}

/** Test/utility hook: clear session ad-hoc foods. */
export function resetAdHocFoods(): void {
  sessionAdHocFoods = [];
}

/** Search across system foods + this session's ad-hoc foods. */
export function searchFoods(query: string): Food[] {
  return shared.searchFoods([...shared.SYSTEM_FOODS, ...sessionAdHocFoods], query);
}

/** Available portion units for a food (generic g/ml + that food's specifics). */
export function getPortionUnits(foodId: string | undefined): PortionUnit[] {
  return shared.getAvailablePortionUnits(
    foodId,
    shared.genericPortionUnits(),
    shared.SYSTEM_PORTION_UNITS,
  );
}

/** Initial unit a UI should select for the given units. */
export function getDefaultPortionUnit(units: PortionUnit[]): PortionUnit | undefined {
  return shared.getDefaultPortionUnit(units);
}

/** Compute the single-food preview (grams + scaled nutrition). */
export function computePreview(
  food: Food,
  unit: PortionUnit,
  quantity: number,
): FoodPreview {
  return shared.calculateFoodPreview(food, unit, quantity);
}

/**
 * Create a session-only ad-hoc food and add it to the session list. The
 * returned food is immediately usable for preview/search in this session.
 */
export function createAdHocFood(input: AdHocFoodInput): Food {
  const food = shared.createAdHocFood(input);
  sessionAdHocFoods = [...sessionAdHocFoods, food];
  return food;
}

/**
 * Map a thrown error to a user-facing (Chinese) message. Emphasises clear,
 * actionable text rather than raw English exception strings.
 */
export function toUserMessage(err: unknown): string {
  if (shared.isServiceError(err)) {
    if (err.code === 'validation') return err.message || '输入无效，请检查后重试';
    return '操作失败，请稍后重试';
  }
  if (err instanceof Error) return err.message || '操作失败，请稍后重试';
  return '操作失败，请稍后重试';
}
