# Development Plan - Family Meal Log MVP

This file is the authoritative milestone scope reference for the repository.

Legend: `done`

---

## M0 - Foundation and shell `done`

**Goal:** establish a clean Mini Program repository with a shared domain layer and a validation
gate.

**Delivered scope:**

- repository structure and baseline docs,
- shared types, validation, and nutrition helpers,
- TypeScript strict configuration,
- `scripts/build-shared.mjs`,
- `scripts/validate.mjs`,
- offline-capable Mini Program shell.

**Acceptance (verified by `npm run validate`):**

- repo structure is complete,
- no committed env ids or secrets,
- shared runtime builds successfully.

## M1 - Identity and family profiles `done`

**Goal:** trusted WeChat identity and owner-scoped family-member management.

**Delivered scope:**

- `login` upserts users from server-derived `OPENID`,
- `profileApi` list/create/update/setDefault/get,
- active-profile resolution and local profile-id persistence,
- first-profile onboarding,
- owner isolation and client-safe DTOs.

**Acceptance (verified by `npm run validate`):**

- login is idempotent,
- first profile becomes default,
- profile replay via `requestId` works,
- cross-owner access is rejected.

## M2 - Food catalog and portion units `done`

**Goal:** food search and portion-driven nutrition preview.

**Delivered scope:**

- bundled seed foods,
- session-only ad-hoc foods,
- generic and food-specific portion units,
- portion-to-gram conversion,
- single-item nutrition preview through the shared layer,
- nutrition provenance metadata.

**Acceptance (verified by `npm run validate`):**

- search works across names/categories,
- preview nutrition is deterministic,
- invalid ad-hoc input is rejected,
- client food-catalog logic stays cloud-free.

## M3 - Manual meal logging `done`

**Goal:** persist a trusted manual meal record.

**Delivered scope:**

- multi-item draft meals,
- meal date and type,
- `mealApi.create` and `mealApi.get`,
- server-side validation and nutrition recomputation,
- stored `foodSnapshot` and `portionGramsPerUnit`,
- request replay through `requestId`.

**Acceptance (verified by `npm run validate`):**

- meals save and reload consistently,
- server ignores client totals and owner identity,
- repeated `requestId` replays the original meal,
- atomic hardening path is documented around `meals(ownerOpenid, requestId)` unique indexing.

## M4 - Daily history, edit, and delete `done`

**Goal:** review and maintain meal records by day.

**Delivered scope:**

- `mealApi.list`, `mealApi.update`, and `mealApi.delete`,
- home-page daily totals and history,
- edit navigation back into add-meal,
- delete flow with refreshed day totals.

**Acceptance (verified by `npm run validate`):**

- list queries are scoped by owner, profile, and date,
- updates move meals across days correctly,
- deletes remove meals from daily history and totals.

## M5 - Saved foods and recipes `done`

**Goal:** make repeated logging faster through reusable foods and simple recipes.

**Delivered scope:**

- saved-food CRUD,
- recipe CRUD,
- recipe per-serving nutrition calculation in the shared layer,
- recipe servings available as meal items,
- library page for saved foods and recipes.

**Acceptance (verified by `npm run validate`):**

- duplicate save requests reuse the same saved food,
- recipes compute per-serving nutrition from ingredient totals,
- recipe servings can be logged into meals.

## M6 - Photo upload `done`

**Goal:** attach an optional photo to a meal record.

**Delivered scope:**

- choose image from device,
- upload to CloudBase Storage,
- persist `photoFileId` on meals,
- allow photo removal on edit,
- keep manual save working when upload fails.

**Acceptance (verified by `npm run validate` for automatable scope):**

- meals can store and clear `photoFileId`,
- photo-aware meals still validate,
- manual save works without a photo.

Manual storage-permission verification remains in the human runbook.

## M7 - AI suggestions (mock) `done`

**Goal:** support an end-to-end AI-assisted but still human-confirmed workflow.

**Delivered scope:**

- `aiAnalyze` mock provider,
- advisory `ai_analyses` persistence,
- add-meal AI suggestion review/edit/confirm flow,
- `aiAnalysisId` linkage on meals,
- `ai_assisted` meal source when confirmed AI items are saved.

**Acceptance (verified by `npm run validate` for automatable scope):**

- AI analyses persist separately from meals,
- suggestions do not create meals until confirmed,
- confirmed AI items still use shared nutrition recomputation,
- provider failure degrades to a failed advisory result.

## M8 - Real AI provider `done`

**Goal:** place a real provider behind the same interface without exposing secrets to the client.

**Delivered scope:**

- provider selection by `AI_PROVIDER`,
- explicit `AI_PROVIDER=disabled` mode,
- exact real-provider mode `AI_PROVIDER=openai-compatible`,
- `AI_API_URL`, `AI_API_KEY`, `AI_MODEL`, and `AI_TIMEOUT_MS` cloud env configuration,
- server-side `photoFileId` to temporary CloudBase URL resolution for multimodal requests,
- timeout normalization and malformed-response handling,
- mocked transport tests for the real-provider adapter.

**Acceptance (verified by `npm run validate` for automatable scope):**

- switching providers requires no client change,
- client files do not reference provider secrets,
- missing config and malformed responses fail safely.

Real-secret setup and live provider verification remain in the human runbook.

---

## Cross-cutting definition of done

- TypeScript strict passes.
- `npm run validate` is green.
- shared validation and nutrition remain the single source of truth.
- owner isolation is enforced server-side.
- docs and manual test artifacts are updated.
- unexecuted device/deployment steps remain explicitly marked as pending manual verification.
