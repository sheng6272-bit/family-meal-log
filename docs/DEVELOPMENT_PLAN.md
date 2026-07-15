# Development Plan - Family Meal Log MVP

Small, verifiable milestones. Manual logging is prioritized first; AI remains optional and
advisory.

Legend: `done` / `planned`

---

## M0 - Foundation and shell `done`

**Goal:** a clean repository foundation and a compilable Mini Program shell.

**Scope:** repo structure, README + docs, shared schemas/validation/nutrition, config
templates, minimal app shell, placeholder cloud functions, validation command.

**Acceptance:**

- `npm run validate` passes.
- No secrets, env IDs, or appid are committed.
- Home and add-meal compile and navigate; offline shell mode works.

## M1 - Identity and family profiles `done`

**Goal:** real WeChat identity and family-member management under the single-owner model.

**Scope:** `login` upserts `users`; `profileApi` list/create/update/setDefault/get; first-run
profile onboarding; profile management UI; active-profile resolution and local persistence;
shared-runtime packaging into cloud functions; client-safe identity.

**Acceptance (verified by `npm run validate`):**

- Login is server-derived and idempotent.
- First profile becomes default automatically.
- Profile names are trimmed; empty names and invalid relations are rejected.
- Unknown fields and client-supplied `ownerOpenid` are ignored.
- Access is owner-scoped.
- Default persistence and stale-local fallback work.

## M2 - Food catalog and portion units `done`

**Goal:** foods and portion-to-gram conversion in the UI.

**Scope:**

- Curated bundled system food seed dataset.
- Food search and selection.
- Session-only ad-hoc foods.
- Generic and food-specific portion units.
- Portion-to-gram conversion.
- Single-item live nutrition preview via the shared layer.
- Nutrition provenance metadata on foods.

**Explicitly excluded from M2:**

- Meal saving or `mealApi` CRUD.
- Daily history.
- Recipes.
- Photo upload.
- AI recognition.

**Acceptance (verified by `npm run validate`):**

- Selecting a food + unit + quantity shows correct grams and calories/macros.
- Invalid inputs are rejected with clear Chinese messages.
- Ad-hoc foods are usable immediately and are not written to CloudBase.
- Nutrition provenance is present on both seed and ad-hoc foods.
- Food-catalog logic stays cloud-free and AI-free.

## M3 - Manual meal logging `done`

**Goal:** the primary end-to-end workflow - combine foods into a meal and persist it.

**Scope:**

- Multiple food items per meal.
- Meal type and date.
- Server-side validation and nutrition recomputation.
- `mealApi.create` and `mealApi.get`.
- Stable client `requestId` replay for retries.
- Historical `foodSnapshot` and `portionGramsPerUnit` persistence.

**Explicitly excluded from M3:**

- Daily history queries.
- Edit and delete.
- Saved foods.
- Recipes.
- Photo upload.
- AI suggestions/providers.

**Acceptance (verified by `npm run validate`):**

- A meal saves and reloads identically.
- `totals` equal the confirmed-item sum.
- Server overwrites client-supplied totals and owner identity.
- Repeated `requestId` returns the original meal; a new `requestId` creates a new meal.
- Works with AI disabled.

## M4 - Daily history, edit, and delete `planned`

**Goal:** review and maintain records.

**Scope:** query meals by `(owner, profile, date)`, group by slot, show per-day totals, and
support edit/delete flows.

**Acceptance:**

- Changing date/member shows the correct meals and totals.
- Edit and delete update daily totals correctly.

## M5 - Saved foods and recipes `planned`

**Goal:** reuse and simple recipes.

**Scope:** mark foods as saved, manage saved list, define recipes, and add recipe servings to
meals.

**Acceptance:**

- A saved food is reusable across meals.
- Recipe per-serving nutrition equals ingredient sum divided by servings.

## M6 - Photo upload `planned`

**Goal:** attach a photo to a meal.

**Scope:** capture/select photo, upload to CloudBase Storage, store `photoFileId`, and keep
owner-only access.

**Acceptance:**

- A meal can carry a photo.
- Upload failure does not block manual save.

## M7 - AI suggestions (mock) `planned`

**Goal:** end-to-end AI-assisted flow with a mock provider first.

**Scope:** `aiAnalyze` mock suggestions, confirm/correct UX, advisory persistence, recompute
nutrition from confirmed items only.

**Acceptance:**

- Suggestions never count until confirmed.
- AI failure degrades cleanly to manual entry.
- Final nutrition always comes from the shared layer.

## M8 - Real AI provider `planned`

**Goal:** swap mock for a real provider behind the same interface.

**Scope:** concrete provider chosen by `AI_PROVIDER`; secrets only in cloud-function env vars;
timeouts and graceful failure.

**Acceptance:**

- Switching providers requires no client change.
- No secret appears in the repo or client bundle.
- Provider errors degrade to manual/mock.

---

## Cross-cutting definition of done

- TypeScript strict passes.
- `npm run validate` is green.
- Shared validation/nutrition remain the single source of truth.
- No secrets or generated files are committed.
- Docs and manual checklist are updated for touched behavior.
- Any unexecuted device checks are recorded as pending manual verification.
