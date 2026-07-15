# Architecture - Family Meal Log MVP

> Status: **M0 done**, **M1 done**, **M2 done**, **M3 done**. Current verified
> `npm run validate` baseline: **176 passed, 0 failed**.

## 1. High-level overview

```text
WeChat Mini Program
  pages/              thin UI layer
  services/           cloud wrapper + client adapters
  lib/shared/         generated runtime copy
          |
          v
Tencent CloudBase
  login               server-trusted identity
  profileApi          family profile management
  mealApi             manual meal create/get
  aiAnalyze           mock/future AI adapter
          |
          v
shared/
  types, validation, nutrition, services
  single source of truth for domain rules
```

Two trust boundaries matter:

- **Nutrition boundary:** final grams and nutrition values come from the shared layer.
- **Identity boundary:** `openid` comes only from the server-side WeChat context.

## 2. Frontend architecture

- Native WeChat Mini Program, TypeScript strict mode.
- Pages stay a **thin view layer**: local state, user events, rendering.
- Services are the client boundary:
  - `cloud.ts`: the only `wx.cloud` touchpoint.
  - `auth.ts`: wraps `login`.
  - `profile.ts`: wraps `profileApi`.
  - `session.ts`: resolves the active profile and persists only the profile id locally.
  - `food-catalog.ts`: shared wrapper for seed search, ad-hoc foods, units, and preview.
  - `meal.ts`: wraps `mealApi.create` / `mealApi.get`, generates `requestId`, maps errors.
  - `ai/*`: optional AI adapter path, still non-essential to manual logging.

Current page roles:

- `home`: active profile and entry points.
- `profiles` / `profile-edit`: M1 profile management.
- `add-meal`: M3 manual meal workflow. The page:
  - shows the active profile, date, and meal type,
  - searches bundled foods or defines ad-hoc foods,
  - previews one item at a time through shared logic,
  - builds a multi-item local draft meal,
  - saves through `mealApi.create`,
  - reloads through `mealApi.get`,
  - blocks save cleanly when offline or no active profile is selected.

## 3. Shared runtime packaging

`shared/` is the only implementation of validation, nutrition math, and meal/profile logic.

`npm run build:shared`:

1. Compiles `shared/` to CommonJS in `shared/dist/`.
2. Copies the runtime into each cloud function under `cloudfunctions/*/lib/shared/`.
3. Copies the same runtime into `miniprogram/lib/shared/`.

Properties:

- No symlinks.
- Generated artifacts stay git-ignored.
- Cloud functions and the Mini Program run the same domain logic.

## 4. CloudBase architecture

Cloud functions are the trusted server boundary.

- `login` derives identity from `cloud.getWXContext().OPENID`.
- `profileApi` manages owner-scoped family profiles.
- `mealApi` handles M3 meal create/get with shared validation and server recomputation.
- `aiAnalyze` remains mock-first and optional.

The client is **not trusted** for:

- `openid`
- final `totals`
- system-food nutrition values
- ownership of profiles or meals

## 5. Collections

| Collection | Purpose | Current status |
|------------|---------|----------------|
| `users` | one record per WeChat user; stores `defaultFamilyProfileId` | M1 |
| `family_profiles` | owner-scoped family members | M1 |
| `idempotency_keys` | request replay for profile create | M1 |
| `foods` | future reusable foods | later |
| `portion_units` | future persisted units if needed | later |
| `meals` | owner-scoped meal records with embedded snapshots | M3 |
| `recipes` | recipe reuse | M5 |
| `ai_analyses` | advisory AI records | M7 |

## 6. Current meal design (M3)

Meal save is intentionally narrow in this checkpoint:

- `mealApi.create` accepts draft meal input from the client.
- The server validates the target family profile belongs to the caller.
- System foods are canonicalized from `shared/data/system-foods.ts`.
- Ad-hoc foods are normalized through the shared ad-hoc food service.
- Portion labels are resolved by shared portion logic.
- Each stored item snapshots:
  - `foodSnapshot`
  - `portionGramsPerUnit`
  - `grams`
  - `nutrition`
- The server recomputes `totals` from confirmed items.
- `mealApi.get` reloads the trusted stored record immediately after create.

Client-safe DTO rule:

- Responses exclude `ownerOpenid`.
- Responses exclude `requestId`.

## 7. Request replay and idempotency

Two request-replay patterns currently exist:

- **Profiles:** `idempotency_keys` records `(ownerOpenid, operation, requestId)`.
- **Meals:** the current M3 flow queries `meals` by `(ownerOpenid, requestId)` before and after
  insert.

Both are **best-effort**, not atomic. This is honest and intentional in the docs. Recommended
future hardening:

- unique composite index for profile replay,
- unique composite index on `meals(ownerOpenid, requestId)` for atomic meal replay.

## 8. Security rules of the architecture

- The client never sends, receives, logs, or stores `openid`.
- The client never writes directly to user-owned collections.
- Unknown fields from the client are ignored or dropped server-side.
- Meal nutrition is always recomputed at the trusted boundary.
- Offline/manual preview remains available even when cloud save is blocked.

## 9. Deferred work beyond M3

- M4: daily history, edit, delete.
- M5: saved foods and recipes.
- M6: photo upload and private storage flow.
- M7: mock AI confirmation flow.
- M8: real AI provider behind the same interface.
