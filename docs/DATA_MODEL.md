# Data Model - Family Meal Log MVP

Authoritative definitions live in `shared/types.ts` and `shared/constants.ts`. This document is
the human-readable summary for the finished M0-M8 MVP.

Conventions:

- `_id`: CloudBase document id.
- `ownerOpenid`: server-derived trusted owner identity.
- `createdAt` / `updatedAt`: epoch milliseconds.
- `date`: `YYYY-MM-DD`.
- calories in kcal; protein/carb/fat in grams.

## 1. Enumerations

- `MealType = breakfast | lunch | dinner | snack`
- `RecordSource = manual | ai_assisted`
- `ItemSource = manual | ai_suggested`
- `FoodSource = system | user | recipe`
- `FamilyRelation = self | spouse | child | parent | other`
- `AiAnalysisStatus = pending | succeeded | failed`

## 2. Required collections

| Collection | Purpose |
|------------|---------|
| `users` | one record per WeChat user |
| `family_profiles` | owner-scoped family members |
| `idempotency_keys` | request replay for profile create |
| `meals` | persisted meals with embedded item snapshots |
| `foods` | owner-scoped saved foods |
| `recipes` | owner-scoped recipes |
| `ai_analyses` | advisory AI analyses |

## 3. Required indexes

| Collection | Index | Notes |
|------------|-------|-------|
| `users` | `openid` unique | one user record per WeChat identity |
| `family_profiles` | `(ownerOpenid, createdAt)` | deterministic owner-scoped listing |
| `idempotency_keys` | `(ownerOpenid, operation, requestId)` | request replay for profile create |
| `meals` | `(ownerOpenid, familyProfileId, date)` | daily history queries |
| `meals` | `(ownerOpenid, requestId)` unique | required for atomic meal create replay |
| `foods` | `(ownerOpenid, updatedAt)` | saved-food listing |
| `recipes` | `(ownerOpenid, updatedAt)` | recipe listing |
| `ai_analyses` | `(ownerOpenid, createdAt)` | advisory-history listing if needed later |

## 4. Core entities

### User

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `openid` | string | yes | server-derived only |
| `defaultFamilyProfileId` | string | no | single source of truth for default profile |
| `createdAt` / `updatedAt` | number | yes | |

### FamilyProfile

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `ownerOpenid` | string | yes | trusted owner |
| `name` | string | yes | trimmed, non-empty |
| `relation` | `FamilyRelation` | yes | |
| `createdAt` / `updatedAt` | number | yes | |

Important rule:

- `isDefault` is never stored on profile docs.

### IdempotencyKey

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `ownerOpenid` | string | yes | |
| `operation` | string | yes | currently profile create |
| `requestId` | string | yes | stable client replay key |
| `resultId` | string | yes | produced document id |
| `createdAt` | number | yes | |

## 5. Food and recipe entities

### Food

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `name` | string | yes | |
| `brand` | string | no | |
| `category` | string | no | |
| `per100g` | `NutritionValues` | yes | |
| `source` | `FoodSource` | yes | `system`, `user`, or `recipe` |
| `ownerOpenid` | string | no | only for saved user foods |
| `isSaved` | boolean | yes | persisted saved-food flag |
| `linkedFoodId` | string | no | reference back to a canonical system food when relevant |
| `nutritionMeta` | `{ source, version }` | yes | nutrition provenance |
| `createdAt` / `updatedAt` | number | yes | |

### FoodSnapshot

Stored inside meals and recipes for historical stability.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `foodId` | string | no | canonical id when available |
| `linkedFoodId` | string | no | canonical system-food link for saved foods |
| `name` | string | yes | |
| `brand` | string | no | |
| `category` | string | no | |
| `per100g` | `NutritionValues` | yes | trusted nutrition basis |
| `source` | `FoodSource` | yes | |
| `nutritionMeta` | `{ source, version }` | yes | |

### Recipe

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `ownerOpenid` | string | yes | trusted owner |
| `name` | string | yes | |
| `servings` | number | yes | > 0 |
| `gramsPerServing` | number | yes | computed from ingredient grams |
| `ingredients` | `RecipeIngredient[]` | yes | embedded snapshots |
| `perServing` | `NutritionValues` | yes | computed by shared logic |
| `createdAt` / `updatedAt` | number | yes | |

### RecipeIngredient

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `foodId` | string | no | |
| `foodName` | string | yes | |
| `foodSnapshot` | `FoodSnapshot` | yes | |
| `grams` | number | yes | > 0 |

## 6. Meal entities

### Meal

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `ownerOpenid` | string | yes | trusted owner |
| `requestId` | string | yes | stable create replay key |
| `familyProfileId` | string | yes | target family member |
| `date` | string | yes | natural day |
| `mealType` | `MealType` | yes | |
| `items` | `MealItem[]` | yes | |
| `totals` | `NutritionValues` | yes | server recomputed |
| `photoFileId` | string | no | CloudBase Storage file id |
| `note` | string | no | reserved, validated when present |
| `aiAnalysisId` | string | no | advisory analysis reference |
| `source` | `RecordSource` | yes | `manual` or `ai_assisted` |
| `createdAt` / `updatedAt` | number | yes | |

### MealItem

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `foodId` | string | no | canonical food/recipe id when present |
| `foodName` | string | yes | |
| `foodSnapshot` | `FoodSnapshot` | yes | |
| `quantity` | number | yes | number of selected units |
| `portionUnitId` | string | no | reserved for persisted portion units |
| `portionLabel` | string | yes | selected unit label snapshot |
| `portionGramsPerUnit` | number | yes | selected grams-per-unit snapshot |
| `grams` | number | yes | resolved total grams |
| `nutrition` | `NutritionValues` | yes | item nutrition at save time |
| `source` | `ItemSource` | yes | `manual` or `ai_suggested` |
| `confirmed` | boolean | yes | only confirmed items persist into meals |

## 7. AI entities

### AiAnalysis

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `ownerOpenid` | string | yes | trusted owner |
| `mealId` | string | no | reserved for later linkage |
| `photoFileId` | string | yes | analyzed photo |
| `provider` | string | yes | `mock`, `disabled`, or real provider name |
| `status` | `AiAnalysisStatus` | yes | |
| `suggestions` | `AiFoodSuggestion[]` | yes | advisory only |
| `errorMessage` | string | no | truncated provider failure details |
| `createdAt` / `updatedAt` | number | yes | |

### AiFoodSuggestion

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `foodName` | string | yes | AI guess |
| `estimatedGrams` | number | yes | > 0 |
| `confidence` | number | yes | 0-1 |
| `per100gGuess` | `NutritionValues` | no | advisory only |
| `matchedFoodId` | string | no | canonical system-food match when available |

## 8. Invariants

1. `openid` and `ownerOpenid` are never trusted from the client.
2. Meal totals are always recomputed server-side.
3. AI suggestions never become nutrition facts until a user confirms them into a meal draft.
4. Meals and recipes embed food snapshots so historical nutrition stays stable even if a saved
   food changes later.
5. Atomic meal create replay depends on the unique `meals(ownerOpenid, requestId)` index.
