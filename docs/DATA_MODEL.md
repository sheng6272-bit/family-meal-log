# Data Model — Family Meal Log MVP (v0.1)

Authoritative TypeScript definitions live in [`shared/types.ts`](../shared/types.ts) and
[`shared/constants.ts`](../shared/constants.ts). This document summarizes the initial
schemas. Conventions:

- `_id` — CloudBase document id (assigned on insert).
- `ownerOpenid` — WeChat openid of the owning account (derived server-side).
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
| _id | string | auto | |
| openid | string | ✓ | WeChat openid; unique; server-derived |
| unionid | string | | when available |
| nickname | string | | optional display name |
| defaultFamilyProfileId | string | | last/selected profile |
| createdAt / updatedAt | number | ✓ | epoch ms |

## 2. FamilyProfile — collection `family_profiles`
| Field | Type | Req | Notes |
|-------|------|-----|-------|
| _id | string | auto | |
| ownerOpenid | string | ✓ | owner |
| name | string | ✓ | e.g. "爸爸" |
| relation | FamilyRelation | ✓ | |
| gender | `male\|female\|unspecified` | | |
| birthDate | string | | YYYY-MM-DD |
| heightCm | number | | ≥ 0 |
| weightKg | number | | ≥ 0 |
| createdAt / updatedAt | number | ✓ | |

## 3. Food — collection `foods`
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

## 4. PortionUnit — collection `portion_units`
| Field | Type | Req | Notes |
|-------|------|-----|-------|
| _id | string | auto | |
| label | string | ✓ | UI text, e.g. "碗", "个", "g" |
| gramsPerUnit | number | ✓ | > 0; gram equivalent of one unit |
| foodId | string | | if set, unit applies to that food only |
| isDefault | boolean | | default unit for the food |
| createdAt / updatedAt | number | ✓ | |

Generic units (`g`, `ml`) are always available (`GENERIC_PORTION_UNITS`).

## 5. Meal — collection `meals`
| Field | Type | Req | Notes |
|-------|------|-----|-------|
| _id | string | auto | |
| ownerOpenid | string | ✓ | owner |
| familyProfileId | string | ✓ | which family member |
| date | string | ✓ | YYYY-MM-DD |
| mealType | MealType | ✓ | |
| items | MealItem[] | ✓ | embedded line items |
| totals | NutritionValues | ✓ | sum of **confirmed** items (server-recomputed) |
| photoFileId | string | | CloudBase storage fileID |
| note | string | | |
| source | RecordSource | ✓ | manual / ai_assisted |
| createdAt / updatedAt | number | ✓ | |

Suggested index: (`ownerOpenid`, `familyProfileId`, `date`).

## 6. MealItem (embedded in Meal)
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

## 7. Recipe — collection `recipes`
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

## 8. AiAnalysis — collection `ai_analyses`
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
