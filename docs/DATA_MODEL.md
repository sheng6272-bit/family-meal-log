# Data Model — Family Meal Log MVP (v0.1)

Authoritative TypeScript definitions live in [`shared/types.ts](../shared/types.ts) and
[`shared/constants.ts`](../shared/constants.ts). This document summarizes the initial
schemas. Conventions:

- `_id` — CloudBase document id (assigned on insert).
- `ownerOpenid` — WeChat openid of the owning account (**server-derived, never trusted from
  the client**).
- Timestamps `createdAt` / `updatedAt` — epoch **milliseconds** (number).
- Grouping dates (`date`, `birthDate`) — `YYYY-MM-DD` strings (local day).
- Nutrition — `calories` in **kcal**, `protein`/`carb`/`fat` in **grams**.

Enumerations (`shared/constants.ts`):
- `MealType` = `breakfast | lunch | dinner | snack`
- `RecordSource` = `manual | ai_assisted`
- `ItemSource` = `manual | ai_suggested`
- `FoodSource` = `system | user | recipe`
- `FamilyRelation` = `self | spouse | child | parent | other`
- `AiAnalysisStatus` = `pending | succeeded | failed`

**Local natural-day rule (recorded for M1):** a meal belongs to the device's local calendar
day, expressed as `YYYY-MM-DD` with the day running `00:00–23:59`. This convention is decided
now; meal entities using it land in M3.

---

## Required indexes

| Collection | Index | Purpose |
|-----------|-------|---------|
| `users` | `openid` **unique** | one document per WeChat user; idempotent upsert |
| `family_profiles` | `ownerOpenid` (asc) + `createdAt` (asc) | owner-scoped list, deterministic order |

> Race condition note: CloudBase document DB does not offer a transactional `findOrCreate`
> with a guaranteed unique constraint in the same call as a normal query+insert. The
> `login` service mitigates by upserting on `openid` (query then insert only when absent)
> and treating `openid` as the ownership key. If CloudBase later supports a unique-index
> enforced `upsert`, switch to it; until then, the query-then-insert is the documented
> mitigation and is safe under normal single-caller concurrency (one openid per user).

---

## NutritionValues (embedded value object)
| Field | Type | Notes |
|-------|------|-------|
| calories | number | kcal, ≥ 0 |
| protein | number | g, ≥ 0 |
| carb | number | g, ≥ 0 |
| fat | number | g, ≥ 0 |

## 1. User — collection `users`
| Field | Type | Req | Notes |
|-------|------|-----|-------|
| _id | string | auto | internal document id |
| openid | string | ✓ | WeChat openid; **unique**; **server-derived only** |
| unionid | string | | when available; server-derived |
| defaultFamilyProfileId | string | | last/selected profile (server-side default) |
| createdAt / updatedAt | number | ✓ | epoch ms |

**Client contract:** the client NEVER receives `openid`/`unionid`. The `login` cloud function
returns only `{ id: <_id>, defaultFamilyProfileId }`. Identity is resolved server-side on
every call.

## 2. FamilyProfile — collection `family_profiles`  (M1)
| Field | Type | Req | Notes |
|-------|------|-----|-------|
| _id | string | auto | |
| ownerOpenid | string | ✓ | owner; **assigned only on the server** |
| name | string | ✓ | trimmed, non-empty, ≤ 30 chars |
| relation | FamilyRelation | ✓ | one of `self \| spouse \| child \| parent \| other` |
| createdAt / updatedAt | number | ✓ | |

**M1 scope:** `name` and `relation` are the only editable attributes. No birth date, height,
weight, calorie target, or medical data yet.

**Validation rules (enforced by `shared/services/profile-service.ts`, server-side):**
- `name`: trimmed; rejected if empty/whitespace-only; capped at 30 chars.
- `relation`: must be a member of `FAMILY_RELATIONS`; otherwise rejected.
- **Unknown fields are not persisted.** Only `name` and `relation` leave the normalization
  step; ownership/timestamp fields submitted by the client are dropped.
- **Ownership is never accepted from the client.** `ownerOpenid` is set server-side from the
  trusted openid; any client-supplied value is ignored.
- **Updates** cannot change `_id`, owner, or `createdAt`.

**Deletion:** out of scope for M1. Create / list / update / select / set-default only.
Archive/soft-delete will be designed later.

## 3. Food — collection `foods` (M2)
| Field | Type | Req | Notes |
|-------|------|-----|-------|
| _id | string | auto | |
| name | string | ✓ | |
| brand | string | | |
| category | string | | |
| per100g | NutritionPer100g | ✓ | nutrition density per 100 g |
| source | FoodSource | ✓ | system / user / recipe |
| ownerOpenid | string | | set for user-custom foods |
| isSaved | boolean | ✓ | appears in "saved foods" |
| createdAt / updatedAt | number | ✓ | |

## 4. PortionUnit — collection `portion_units` (M2)
| Field | Type | Req | Notes |
|-------|------|-----|-------|
| _id | string | auto | |
| label | string | ✓ | UI text, e.g. "碗", "个", "g" |
| gramsPerUnit | number | ✓ | > 0; gram equivalent of one unit |
| foodId | string | | if set, unit applies to that food only |
| isDefault | boolean | | default unit for the food |
| createdAt / updatedAt | number | ✓ | |

Generic units (`g`, `ml`) are always available (`GENERIC_PORTION_UNITS`).

## 5. Meal — collection `meals` (M3)
| Field | Type | Req | Notes |
|-------|------|-----|-------|
| _id | string | auto | |
| ownerOpenid | string | ✓ | owner |
| familyProfileId | string | ✓ | which family member |
| date | string | ✓ | YYYY-MM-DD (local day the meal belongs to) |
| mealType | MealType | ✓ | |
| items | MealItem[] | ✓ | embedded line items |
| totals | NutritionValues | ✓ | sum of **confirmed** items (server-recomputed) |
| photoFileId | string | | CloudBase storage fileID (M6) |
| note | string | | |
| source | RecordSource | ✓ | manual / ai_assisted |
| createdAt / updatedAt | number | ✓ | |

Suggested index: (`ownerOpenid`, `familyProfileId`, `date`).

## 6. MealItem (embedded in Meal) (M3)
| Field | Type | Req | Notes |
|-------|------|-----|-------|
| foodId | string | | reference to Food (optional for ad-hoc) |
| foodName | string | ✓ | denormalized snapshot for stable history |
| quantity | number | ✓ | ≥ 0; number of portion units |
| portionUnitId | string | | |
| portionLabel | string | ✓ | snapshot, e.g. "碗" |
| grams | number | ✓ | quantity × gramsPerUnit |
| nutrition | NutritionValues | ✓ | scaled to `grams` |
| source | ItemSource | ✓ | manual / ai_suggested |
| confirmed | boolean | ✓ | AI items must be confirmed to count |

## 7. Recipe — collection `recipes` (M5)
| Field | Type | Req | Notes |
|-------|------|-----|-------|
| _id | string | auto | |
| ownerOpenid | string | ✓ | owner |
| name | string | ✓ | |
| servings | number | ✓ | > 0 |
| ingredients | RecipeIngredient[] | ✓ | non-empty |
| perServing | NutritionValues | ✓ | computed |
| createdAt / updatedAt | number | ✓ | |

**RecipeIngredient:** `foodId?`, `foodName` (req), `grams` (req, ≥ 0).

## 8. AiAnalysis — collection `ai_analyses` (M7)
| Field | Type | Req | Notes |
|-------|------|-----|-------|
| _id | string | auto | |
| ownerOpenid | string | ✓ | owner |
| mealId | string | | linked meal, if any |
| photoFileId | string | ✓ | analyzed photo |
| provider | string | ✓ | "mock" / future |
| status | AiAnalysisStatus | ✓ | pending / succeeded / failed |
| suggestions | AiFoodSuggestion[] | ✓ | advisory only |
| errorMessage | string | | on failure |
| createdAt / updatedAt | number | ✓ | |

**AiFoodSuggestion:** `foodName` (req), `estimatedGrams` (req), `confidence` (0..1),
`per100gGuess?`, `matchedFoodId?`.

> AI records are **advisory**. Final nutrition is always recomputed from confirmed
> `MealItem`s by the shared nutrition layer, never taken directly from AI suggestions.
