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
| `idempotency_keys` | `ownerOpenid` + `operation` + `requestId` **composite (currently non-unique)** | best-effort request idempotency for create ops (promote to unique index at M3) |

> Race condition note: CloudBase document DB does not offer a transactional `findOrCreate`
> with a guaranteed unique constraint in the same call as a normal query+insert. The
> `login` service mitigates by upserting on `openid` (query then insert only when absent)
> and treating `openid` as the ownership key. If CloudBase later supports a unique-index
> enforced `upsert`, switch to it; until then, the query-then-insert is the documented
> mitigation and is safe under normal single-caller concurrency (one openid per user).

> **Idempotency is best-effort (尽力式请求幂等) — M1.1.** Profile creation uses *client
> in-flight protection plus server-side request replay handling*: the client generates a
> stable `requestId` per edit session and the server records it in `idempotency_keys`, keyed
> by `(ownerOpenid, operation, requestId)`, then replays the originally created profile on a
> repeat with the same `requestId`. This is **best-effort request idempotency**, **not**
> strict/atomic idempotency. Key facts:
> - **Same `requestId`** → normally returns the original result (no duplicate created).
> - **Different `requestId`s** → always treated as a new intent, so profiles with **identical
>   names** are allowed (names are not a uniqueness key).
> - The `findIdempotencyKey` → (create profile) → `saveIdempotencyKey` sequence is **not
>   atomic**; two truly-concurrent same-`requestId` calls could both miss the lookup and each
>   create a profile before either writes the key. This is the **residual concurrency race**.
> - The **UI in-flight guard** (`submitting` flag) reduces the practical risk for this
>   single-owner family MVP, where one user taps "save" once.
> - A future **generic atomic** solution should claim the idempotency key **before** entity
>   creation — e.g. a **unique** composite index on `(ownerOpenid, operation, requestId)` so a
>   duplicate-key insert error means "already processed → return the stored `resultId`."
> - That stronger implementation is scheduled for **M3**, when meal creation also requires
>   idempotency (same pattern, higher write volume).
> See ARCHITECTURE.md §5b and SECURITY.md §3.

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
| defaultFamilyProfileId | string | | **single source of truth** for the default profile |
| createdAt / updatedAt | number | ✓ | epoch ms |

**Client contract:** the client NEVER receives `openid`/`unionid`. The `login` cloud function
returns only `{ id: <_id>, defaultFamilyProfileId }`. Identity is resolved server-side on
every call.

**Default-profile single source of truth (M1.1):** `users.defaultFamilyProfileId` is the
**only** persisted representation of which profile is the default. `setDefault` writes only
this field — it never touches profile documents. There is **no** `isDefault` column on
`family_profiles`; the client-facing `isDefault` flag is **computed in the DTO** as
`profile.id === user.defaultFamilyProfileId`. A missing or stale `defaultFamilyProfileId`
(pointing at a deleted/foreign profile) simply yields **no** profile marked default — a safe
fallback with zero data repair required.

## 2. FamilyProfile — collection `family_profiles`  (M1)
| Field | Type | Req | Notes |
|-------|------|-----|-------|
| _id | string | auto | |
| ownerOpenid | string | ✓ | owner; **assigned only on the server** |
| name | string | ✓ | trimmed, non-empty, ≤ 30 chars |
| relation | FamilyRelation | ✓ | one of `self \| spouse \| child \| parent \| other` |
| createdAt / updatedAt | number | ✓ | |

> **No `isDefault` field is stored here (M1.1).** Default state lives solely on
> `users.defaultFamilyProfileId`; the client DTO computes `isDefault` at read time.

> **`name` is NOT a uniqueness key (M1.1).** The same owner may hold multiple profiles with
> an identical `name` (and even identical `name + relation`) — e.g. two children both called
> "宝宝". No name-based deduplication is performed on create. Accidental double-submits are
> prevented by (a) a UI in-flight guard and (b) **best-effort** request-level idempotency via
> a client-generated `requestId` (see `idempotency_keys`), **not** by comparing names.

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

## 2b. IdempotencyKey — collection `idempotency_keys` (M1.1)
| Field | Type | Req | Notes |
|-------|------|-----|-------|
| _id | string | auto | |
| ownerOpenid | string | ✓ | owner; **server-derived only** |
| operation | string | ✓ | logical operation, e.g. `create` (family profile) |
| requestId | string | ✓ | client-generated high-entropy id, stable per edit session |
| resultId | string | ✓ | `_id` of the entity created by the first request |
| createdAt | number | ✓ | epoch ms |

**Purpose:** make write operations **best-effort** replay-safe. The tuple
`(ownerOpenid, operation, requestId)` identifies one logical intent. A repeated request with
the same tuple returns the originally created entity (`resultId`) instead of creating a
duplicate; a *different* `requestId` is always treated as a new intent — even with identical
payload. This is **best-effort request idempotency (尽力式请求幂等)**, not an atomic guarantee
(see the race note above).

**Client contract (create profile):**
```json
{ "action": "create",
  "requestId": "req_<time36>_<random>",
  "profile": { "name": "爸爸", "relation": "parent" } }
```
The server scopes the key by the trusted `ownerOpenid` (never by any client-supplied owner),
so two different users may safely reuse the same `requestId` string without collision.

## 3. Food — collection `foods` (M2)
| Field | Type | Req | Notes |
|-------|------|-----|-------|
| _id | string | auto | |
| name | string | ✓ | |
| brand | string | | |
| category | string | | |
| per100g | NutritionPer100g | ✓ | nutrition density per 100 g |
| source | FoodSource | ✓ | business origin: system / user / recipe |
| nutritionMeta | NutritionDataMetadata | ✓ | **provenance of the nutrition numbers** (see below) |
| ownerOpenid | string | | set for user-custom foods (server-derived; never trusted from client) |
| isSaved | boolean | ✓ | appears in "saved foods" |
| createdAt / updatedAt | number | ✓ | |

> **Two distinct "source" concepts (M2).** `Food.source` (type `FoodSource`) is the
> **business origin** of the food item (`system` = shipped seed catalog, `user` =
> user-entered ad-hoc, `recipe` = derived from a recipe). `Food.nutritionMeta.source`
> (type `string`) is the **provenance of the nutrition numbers themselves** — where the
> per-100g values came from. They are intentionally separate so a `user`-entered food can
> record `nutritionMeta.source: 'user_entered'` while a `system` food records
> `nutritionMeta.source: 'curated_mvp_seed'`. We **never** claim an external authority
> (USDA, brand lab, etc.) unless that provenance is actually verified; the MVP seed uses
> the honest internal tag `curated_mvp_seed`.

**`NutritionDataMetadata` (M2):**
| Field | Type | Req | Notes |
|-------|------|-----|-------|
| source | string | ✓ | non-empty; provenance tag, e.g. `curated_mvp_seed` / `user_entered` |
| version | string | ✓ | non-empty; schema/version of the nutrition data, e.g. `1` |

**Seed foods (M2):** `source: 'system'`, `isSaved: false`, `ownerOpenid: undefined`, and
`nutritionMeta: { source: 'curated_mvp_seed', version: '1' }`. The seed catalog lives in
`shared/data/system-foods.ts`, is bundled into the Mini Program runtime (offline-capable),
and is **never** written to CloudBase in M2.

**Ad-hoc foods (M2):** created session-only via `createAdHocFood`; `source: 'user'`,
`isSaved: false`, `ownerOpenid: undefined` (client-supplied ownership is dropped), and
`nutritionMeta: { source: 'user_entered', version: '1' }`. They live only for the current
session and are **not** persisted in M2.

> `validateFood` (shared) requires a non-empty `nutritionMeta.source` **and**
> `nutritionMeta.version`; missing/empty provenance fails validation.

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
