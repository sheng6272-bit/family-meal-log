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
| `idempotency_keys` | `ownerOpenid` + `operation` + `requestId` **unique (composite)** | request-level idempotency for create operations |

> Race condition note: CloudBase document DB does not offer a transactional `findOrCreate`
> with a guaranteed unique constraint in the same call as a normal query+insert. The
> `login` service mitigates by upserting on `openid` (query then insert only when absent)
> and treating `openid` as the ownership key. If CloudBase later supports a unique-index
> enforced `upsert`, switch to it; until then, the query-then-insert is the documented
> mitigation and is safe under normal single-caller concurrency (one openid per user).

> **Idempotency residual-race note (M1.1):** the create path performs a
> `findIdempotencyKey` → (create profile) → `saveIdempotencyKey` sequence, which is **not**
> atomic. Two truly-concurrent requests carrying the *same* `requestId` could both miss the
> lookup and create two profiles before either writes the key. This is mitigated (not
> eliminated) at M1 because (a) the client sends a stable `requestId` per edit session and
> guards against in-flight double-submit in the UI, and (b) the practical concurrency for a
> single user tapping "save" is one. The **generic, race-free** design is deferred to M3:
> promote `idempotency_keys` to a composite **unique index** on
> `(ownerOpenid, operation, requestId)` and treat a duplicate-key insert error as "already
> processed → return the stored `resultId`." This makes the key write the atomic gate
> instead of the read. See ARCHITECTURE.md § Idempotency.

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
> prevented by (a) a UI in-flight guard and (b) request-level idempotency via a
> client-generated `requestId` (see `idempotency_keys`), **not** by comparing names.

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

**Purpose:** make write operations replay-safe. The tuple `(ownerOpenid, operation,
requestId)` uniquely identifies one logical intent. A repeated request with the same tuple
returns the originally created entity (`resultId`) instead of creating a duplicate; a
*different* `requestId` is always treated as a new intent — even with identical payload.

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
