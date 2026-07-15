# Data Model - Family Meal Log MVP

Authoritative TypeScript definitions live in `shared/types.ts` and `shared/constants.ts`.
This document summarizes the current schema shape through M3.

Conventions:

- `_id`: CloudBase document id.
- `ownerOpenid`: server-derived WeChat owner identity.
- `createdAt` / `updatedAt`: epoch milliseconds.
- `date`: `YYYY-MM-DD` local day string.
- `calories`: kcal. `protein` / `carb` / `fat`: grams.

Enumerations:

- `MealType = breakfast | lunch | dinner | snack`
- `RecordSource = manual | ai_assisted`
- `ItemSource = manual | ai_suggested`
- `FoodSource = system | user | recipe`
- `FamilyRelation = self | spouse | child | parent | other`

## 1. Required indexes

| Collection | Index | Purpose |
|------------|-------|---------|
| `users` | `openid` unique | one user doc per WeChat user |
| `family_profiles` | `ownerOpenid + createdAt` | owner-scoped deterministic list |
| `idempotency_keys` | `ownerOpenid + operation + requestId` | profile-create replay |
| `meals` | `ownerOpenid + familyProfileId + date` | day/history queries |
| `meals` | `ownerOpenid + requestId` | recommended future unique hardening for atomic replay |

Note: current meal create replay is **best-effort** and implemented as lookup-before/after-insert
on `(ownerOpenid, requestId)`. It is not yet an atomic uniqueness guarantee.

## 2. User

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `_id` | string | auto | |
| `openid` | string | yes | server-derived only |
| `defaultFamilyProfileId` | string | no | single source of truth for default profile |
| `createdAt` / `updatedAt` | number | yes | |

## 3. FamilyProfile

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `_id` | string | auto | |
| `ownerOpenid` | string | yes | server-derived owner |
| `name` | string | yes | trimmed, non-empty |
| `relation` | `FamilyRelation` | yes | |
| `createdAt` / `updatedAt` | number | yes | |

Important rule: `isDefault` is **not** stored on profiles. Default state lives only on
`users.defaultFamilyProfileId`.

## 4. IdempotencyKey

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `_id` | string | auto | |
| `ownerOpenid` | string | yes | |
| `operation` | string | yes | currently profile create |
| `requestId` | string | yes | client-generated stable request id |
| `resultId` | string | yes | produced document id |
| `createdAt` | number | yes | |

## 5. Food

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `_id` | string | auto | absent for session-only ad-hoc foods |
| `name` | string | yes | |
| `brand` | string | no | |
| `category` | string | no | |
| `per100g` | `NutritionPer100g` | yes | |
| `source` | `FoodSource` | yes | business origin |
| `ownerOpenid` | string | no | future saved/custom foods |
| `isSaved` | boolean | yes | future reusable-food list flag |
| `nutritionMeta` | `NutritionDataMetadata` | yes | provenance of nutrition numbers |
| `createdAt` / `updatedAt` | number | yes | |

Current M2/M3 cases:

- Seed food: `source:'system'`, `nutritionMeta.source:'curated_mvp_seed'`
- Ad-hoc food: `source:'user'`, `nutritionMeta.source:'user_entered'`

## 6. FoodSnapshot

Stored inside meal items for historical stability.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `foodId` | string | no | present for canonical system foods |
| `name` | string | yes | |
| `brand` | string | no | |
| `category` | string | no | |
| `per100g` | `NutritionPer100g` | yes | |
| `source` | `FoodSource` | yes | |
| `nutritionMeta` | `NutritionDataMetadata` | yes | |

## 7. PortionUnit

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `_id` | string | auto | |
| `label` | string | yes | UI label such as `g`, `ml`, `碗`, `个` |
| `gramsPerUnit` | number | yes | must be > 0 |
| `foodId` | string | no | food-specific unit |
| `isDefault` | boolean | no | |
| `createdAt` / `updatedAt` | number | yes | |

## 8. Meal

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `_id` | string | auto | |
| `ownerOpenid` | string | yes | server-derived owner |
| `requestId` | string | yes | client-generated create replay key |
| `familyProfileId` | string | yes | target family member |
| `date` | string | yes | local natural day |
| `mealType` | `MealType` | yes | breakfast/lunch/dinner/snack |
| `items` | `MealItem[]` | yes | embedded line items |
| `totals` | `NutritionValues` | yes | sum of confirmed items, server-recomputed |
| `note` | string | no | reserved for later UI exposure |
| `photoFileId` | string | no | M6 |
| `source` | `RecordSource` | yes | currently `manual` |
| `createdAt` / `updatedAt` | number | yes | |

## 9. MealItem

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `foodId` | string | no | reference for canonical foods |
| `foodName` | string | yes | denormalized name |
| `foodSnapshot` | `FoodSnapshot` | yes | historical nutrition/source snapshot |
| `quantity` | number | yes | number of selected units |
| `portionUnitId` | string | no | optional future persistent unit id |
| `portionLabel` | string | yes | snapshot of selected label |
| `portionGramsPerUnit` | number | yes | snapshot of selected portion size |
| `grams` | number | yes | resolved quantity-to-grams value |
| `nutrition` | `NutritionValues` | yes | item nutrition at save time |
| `source` | `ItemSource` | yes | currently `manual` |
| `confirmed` | boolean | yes | current M3 manual items store `true` |

## 10. Later entities

- `Recipe` and `RecipeIngredient`: M5.
- `AiAnalysis` and `AiFoodSuggestion`: M7.
- Meal photo storage linkage: M6.
