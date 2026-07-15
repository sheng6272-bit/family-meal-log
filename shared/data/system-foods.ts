/**
 * Curated system food catalog (M2).
 *
 * IMPORTANT honesty note: these are curated MVP demo values, NOT scraped from a
 * government/USDA/brand database. `nutritionMeta.source` is therefore
 * `'curated_mvp_seed'` (not e.g. 'USDA'). Numbers are roughly reasonable per
 * 100 g but are NOT medical or laboratory-grade. The UI surfaces the source and
 * version so the provenance is always visible.
 *
 * This file is pure TypeScript and depends only on the shared `Food` /
 * `PortionUnit` types — it works fully OFFLINE (no CloudBase query). User
 * ad-hoc foods are kept separate (see shared/services/food-catalog-service.ts).
 *
 * Design choice: we reuse the single `Food` + `PortionUnit` shapes from
 * `shared/types.ts` rather than inventing a second, conflicting nutrition
 * structure. `isSaved` is always `false` here (these are not user-saved foods),
 * and `ownerOpenid` is intentionally absent (they are not owned by any account).
 */

import type { Food, PortionUnit } from '../types';

const SEED_TS = 0; // static seed; no meaningful creation time

function makeFood(
  id: string,
  name: string,
  category: string,
  per100g: Food['per100g'],
  opts: { brand?: string; servingHint?: string } = {},
): Food {
  return {
    _id: id,
    name,
    category,
    brand: opts.brand,
    per100g,
    source: 'system',
    isSaved: false,
    nutritionMeta: { source: 'curated_mvp_seed', version: '1' },
    createdAt: SEED_TS,
    updatedAt: SEED_TS,
  };
}

function makeUnit(
  foodId: string,
  label: string,
  gramsPerUnit: number,
  isDefault = false,
): PortionUnit {
  return {
    label,
    gramsPerUnit,
    foodId,
    isDefault,
    createdAt: SEED_TS,
    updatedAt: SEED_TS,
  };
}

/** Curated system foods. Stable `_id`s (not random) so clients can cache. */
export const SYSTEM_FOODS: Food[] = [
  makeFood('sys_white_rice_cooked', '熟白米饭', '主食', {
    calories: 116,
    protein: 2.6,
    carb: 25.9,
    fat: 0.3,
  }),
  makeFood('sys_chicken_breast_cooked', '熟鸡胸肉', '肉类', {
    calories: 165,
    protein: 31,
    carb: 0,
    fat: 3.6,
  }),
  makeFood('sys_egg_whole', '鸡蛋', '蛋类', {
    calories: 143,
    protein: 13,
    carb: 1.1,
    fat: 9.5,
  }),
  makeFood('sys_banana', '香蕉', '水果', {
    calories: 89,
    protein: 1.1,
    carb: 22.8,
    fat: 0.3,
  }),
  makeFood('sys_apple', '苹果', '水果', {
    calories: 52,
    protein: 0.3,
    carb: 13.8,
    fat: 0.2,
  }),
  makeFood('sys_milk_whole', '全脂牛奶', '奶类', {
    calories: 61,
    protein: 3.2,
    carb: 4.8,
    fat: 3.3,
  }),
  makeFood('sys_broccoli_cooked', '熟西兰花', '蔬菜', {
    calories: 35,
    protein: 2.4,
    carb: 7.2,
    fat: 0.4,
  }),
  makeFood('sys_tofu_firm', '北豆腐', '豆制品', {
    calories: 116,
    protein: 12.2,
    carb: 2.1,
    fat: 6.7,
  }),
  makeFood('sys_salmon_cooked', '熟三文鱼', '肉类', {
    calories: 208,
    protein: 20,
    carb: 0,
    fat: 13,
  }),
  makeFood('sys_oats_cooked', '熟燕麦', '主食', {
    calories: 71,
    protein: 2.5,
    carb: 12,
    fat: 1.5,
  }),
  makeFood('sys_sweet_potato_cooked', '熟红薯', '主食', {
    calories: 90,
    protein: 2,
    carb: 20,
    fat: 0.1,
  }),
];

/**
 * Food-specific portion units. Each entry is scoped to exactly one food via
 * `foodId`. At most one unit per food carries `isDefault: true` (the unit the
 * UI selects first). Generic units (g, ml) are handled separately in
 * `portion-service.ts` and are always available.
 */
export const SYSTEM_PORTION_UNITS: PortionUnit[] = [
  makeUnit('sys_white_rice_cooked', '碗', 150, true),
  makeUnit('sys_white_rice_cooked', '小碗', 100),
  makeUnit('sys_chicken_breast_cooked', '份', 100, true),
  makeUnit('sys_egg_whole', '个', 50, true),
  makeUnit('sys_banana', '根', 118, true),
  makeUnit('sys_apple', '个', 182, true),
  makeUnit('sys_milk_whole', '杯', 240, true),
  makeUnit('sys_broccoli_cooked', '份', 100, true),
  makeUnit('sys_tofu_firm', '块', 100, true),
  makeUnit('sys_salmon_cooked', '份', 100, true),
  makeUnit('sys_oats_cooked', '碗', 100, true),
  makeUnit('sys_sweet_potato_cooked', '个', 130, true),
];
