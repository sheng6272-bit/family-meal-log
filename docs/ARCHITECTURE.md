# Architecture - Family Meal Log MVP

> Current automated baseline on `feature/mvp-completion`: `npm run validate` -> **142 passed, 0 failed**

## 1. System overview

```text
Mini Program pages
  home                 daily totals + history
  add-meal             create/edit meals, photo, AI suggestion review
  library              saved foods + recipes
  profiles/*           family-member management
        |
        v
Mini Program services
  cloud.ts             only wx.cloud touchpoint
  auth/profile/session
  food-catalog/meal/library
  ai/ai-adapter
        |
        v
Cloud functions
  login
  profileApi
  mealApi
  aiAnalyze
        |
        v
shared/
  types, validation, nutrition, repositories, services
```

Two boundaries matter most:

- **Identity boundary:** `openid` is derived only from `cloud.getWXContext().OPENID`.
- **Nutrition boundary:** final grams and nutrition values come only from shared logic executed
  at the trusted boundary.

## 2. Frontend architecture

The Mini Program stays framework-free and uses a thin-page pattern:

- `pages/*` hold view state, event handlers, and navigation only.
- `services/cloud.ts` is the single client entry point for `wx.cloud.callFunction`.
- `services/session.ts` stores only the active `familyProfileId` locally.
- `services/food-catalog.ts` wraps the generated shared runtime for search, units, and preview.
- `services/meal.ts` wraps meal CRUD and `requestId` generation.
- `services/library.ts` wraps saved-food and recipe operations.
- `services/ai/ai-adapter.ts` calls the cloud AI flow and falls back to local mock behavior only
  when the cloud call itself fails.

Page responsibilities:

- `home`: shows active profile, daily totals, day history, edit/delete entry points.
- `add-meal`: manual drafting, photo upload, optional AI suggestion confirmation, save/update/delete.
- `library`: saved-food list plus recipe create/edit/delete.
- `profiles` and `profile-edit`: family-member lifecycle.

## 3. Shared layer

`shared/` is the source of truth for:

- domain types,
- validation,
- nutrition math,
- portion resolution,
- profile services,
- meal services,
- saved-food services,
- recipe services,
- AI analysis persistence and normalization.

Key rule: client code may preview through the shared runtime, but cloud functions must
re-validate untrusted input and recompute trusted values before persistence.

## 4. Shared runtime packaging

`npm run build:shared`:

1. compiles `shared/` into `shared/dist/`,
2. copies the runtime into `cloudfunctions/*/lib/shared/`,
3. copies the runtime into `miniprogram/lib/shared/`.

The copies are generated artifacts, are git-ignored, and must never be edited manually.

## 5. Cloud function roles

- `login`
  - trusted user upsert,
  - returns client-safe identity metadata only.

- `profileApi`
  - owner-scoped profile list/create/update/setDefault/get,
  - request replay for profile creation through `idempotency_keys`.

- `mealApi`
  - meal create/get/list/update/delete,
  - saved-food and recipe CRUD,
  - canonical system-food resolution,
  - owner-scoped reads and writes,
  - atomic hardening path for meal create replay via unique `(ownerOpenid, requestId)` index.

- `aiAnalyze`
  - persists advisory AI analyses,
  - selects provider by `AI_PROVIDER`,
  - supports `mock`, `disabled`, and real provider modes.

## 6. Data flow highlights

### Manual meal save

1. Client drafts items locally.
2. Client sends `requestId`, profile, date, meal type, optional `photoFileId`, optional `aiAnalysisId`, and items.
3. `mealApi` resolves ownership from server context.
4. Shared meal service canonicalizes foods, resolves portion units, recomputes grams and nutrition, and stores snapshots.
5. Client reloads the trusted saved meal.

### Saved foods and recipes

1. Client calls `mealApi.listLibrary`.
2. Shared services return owner-scoped saved foods and recipes.
3. Recipe nutrition is computed from ingredient snapshots, not copied from the client.

### AI suggestion flow

1. Client uploads an optional meal photo.
2. Client calls `aiAnalyze`.
3. Shared AI service persists an advisory `ai_analysis` record.
4. Suggestions stay outside meals until the user explicitly confirms them into the draft.
5. Final meal nutrition still comes from shared meal recomputation.

## 7. Idempotency and replay

Profile create replay:

- backed by `idempotency_keys(ownerOpenid, operation, requestId)`.

Meal create replay:

- client sends a stable `requestId`,
- repository code writes the meal first,
- duplicate-key handling re-reads the original meal,
- full atomic behavior depends on a unique CloudBase index on `meals(ownerOpenid, requestId)`.

That index creation remains a human setup step and is documented in the final runbook.

## 8. Provider-neutral AI interface

The shared AI service depends on:

```ts
interface AiProviderClient {
  name: string;
  analyze(request): Promise<AiAnalysisResult>;
}
```

Current implementations:

- mock provider,
- disabled provider,
- OpenAI-compatible HTTP provider.

The Mini Program never sees provider secrets and never needs a client change when the provider
switches.

## 9. Human-only steps

Architecture-complete does not mean deployment-complete. The remaining human-only work is
consolidated in [FINAL_HUMAN_RUNBOOK.md](./FINAL_HUMAN_RUNBOOK.md).
