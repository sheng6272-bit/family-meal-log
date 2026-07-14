/**
 * Portion-unit service (M2). Pure, SDK-free helpers for:
 *  - providing the always-available generic units (g, ml)
 *  - merging generic + food-specific units into a deterministic, deduped list
 *  - selecting the default unit for a food
 *
 * Everything here is independently testable and never mutates its inputs.
 */

import type { PortionUnit } from '../types';
import { GENERIC_PORTION_UNITS } from '../constants';
import { validatePortionUnit } from '../validation';

/**
 * The generic units always available, regardless of which food is selected.
 * `g` is the canonical fallback; `ml` is provided as a 1 g/ml MVP approximation
 * (see ARCHITECTURE.md — appropriate only for water-like foods).
 */
export function genericPortionUnits(): PortionUnit[] {
  return GENERIC_PORTION_UNITS.map((u) => ({
    label: u.key,
    gramsPerUnit: u.gramsPerUnit,
    createdAt: 0,
    updatedAt: 0,
  }));
}

/**
 * Merge generic units with the food-specific units that belong to `foodId`.
 * Rules (all deterministic, none mutate inputs):
 *  1. Generic units are ALWAYS present.
 *  2. Food-specific units come BEFORE generic units.
 *  3. A unit label appears at most once (first occurrence wins) — so a
 *     food-specific unit with the same label as a generic one is kept and the
 *     generic duplicate is dropped.
 *  4. Only units whose `foodId` matches (or is absent) are included.
 */
export function getAvailablePortionUnits(
  foodId: string | undefined,
  genericUnits: PortionUnit[],
  specificUnits: PortionUnit[],
): PortionUnit[] {
  const specific = (specificUnits || []).filter(
    (u) => u.foodId !== undefined && u.foodId === foodId,
  );
  const merged = [...specific, ...(genericUnits || [])];
  const seen = new Set<string>();
  const result: PortionUnit[] = [];
  for (const u of merged) {
    if (seen.has(u.label)) continue;
    seen.add(u.label);
    result.push(u);
  }
  return result;
}

/**
 * Pick the unit a food UI should select initially:
 *  - prefer the unit flagged `isDefault: true`,
 *  - else prefer the generic `g`,
 *  - else the first unit that passes validation,
 *  - else `undefined` (no usable unit — caller must surface an error).
 */
export function getDefaultPortionUnit(
  units: PortionUnit[] | undefined,
): PortionUnit | undefined {
  if (!units || units.length === 0) return undefined;
  const def = units.find((u) => u.isDefault === true);
  if (def) return def;
  const g = units.find((u) => u.label === 'g');
  if (g) return g;
  const valid = units.find((u) => validatePortionUnit(u).valid);
  return valid;
}
