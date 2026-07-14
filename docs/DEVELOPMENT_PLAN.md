# Development Plan — Family Meal Log MVP

Small, verifiable milestones. Each has a clear **goal**, **scope**, and **acceptance
criteria**. Manual logging is prioritized; AI is added last and always optional.

Legend: ✅ done · ⬜ planned

---

## M0 — Foundation & shell ✅
**Goal:** a clean, consistent repository foundation and a minimal compilable shell.
**Scope:** directory structure; README + docs (requirements, architecture, data model,
flows, plan); shared schemas/validation/nutrition; config templates (no secrets); minimal
Mini Program shell (app + home + add-meal placeholders); cloud-function placeholders;
validation command.
**Acceptance:**
- `npm run validate` passes (type-check + shared build + structural/logic smoke tests).
- No secrets, env IDs, or appid committed.
- Home and add-meal pages compile and navigate; app runs in offline shell mode.

## M1 — Identity & family profiles ✅ (this task)
**Goal:** real WeChat identity and family-member management under the single-owner model.
**Scope:** `login` upserts `users` (idempotent); `profileApi` (list/create/update/setDefault/
get); first-run "create first profile" onboarding; profile management UI; active-profile
resolution + local persistence; shared-runtime packaging into cloud functions; client-safe
identity (no openid on the client).
**Acceptance (all verified by `npm run validate` M1 tests — green):**
- Login returns a stable server-derived identity; a `users` doc exists; login is idempotent.
- First profile auto-becomes the default; user can create ≥ 2 profiles.
- Profile names are trimmed; empty names and invalid relations are rejected.
- Unknown input fields are not persisted; client-supplied `ownerOpenid` is ignored.
- Access is owner-scoped: another user cannot list/update/set-default the caller's profiles.
- Stale local active-profile id falls back correctly; default persists across a fresh login.
- Repeated submit does not create duplicate profiles (best-effort request idempotency via
  `requestId` + UI in-flight guard; see DATA_MODEL.md idempotency note).
- Shared runtime is packaged into `login` and `profileApi`; no secrets committed.
- **M1 is marked complete only after these acceptance tests pass** (they do).

## M2 — Food catalog & portion units ✅
**Goal:** foods and portion→gram conversion in the UI (no meal persistence yet).
**Scope (exactly):**
- A small curated **system food seed dataset** (`shared/data/system-foods.ts`, 11 foods,
  离线可用，主食/肉类/水果/蔬菜/奶类/蛋/水产…).
- **Food search and selection** (`searchFoods`).
- **User-defined ad-hoc foods** (`createAdHocFood`, session-only, never persisted).
- **Generic portion units** (`g`, `ml`) and **food-specific portion units** (`碗/个/根/杯…`),
  merged with food-specific first.
- **Portion-to-gram conversion** (`quantity × gramsPerUnit → grams`).
- **Live nutrition preview for a single food item** (kcal/protein/carb/fat, 1 decimal), all
  math in the shared layer; the `add-meal` Page holds no nutrition formulas.
- **Source and version metadata** for nutrition records (`Food.nutritionMeta = { source,
  version }`; provenance of nutrition numbers, distinct from `Food.source`).
**Explicitly excluded from M2 (enforced by `validate.mjs` guards):** saving meals; `mealApi`
create/list/get/update/delete; daily meal history; recipes; photo upload; AI recognition.
The "保存这一餐" button is disabled with an M3 note and never fakes success.
**Acceptance (all verified by `npm run validate` M2 tests — green):**
- Selecting a food + unit + quantity shows correct grams and calories/macros matching the
  shared nutrition tests (`scaleNutrition` / `gramsFromPortion`).
- Invalid inputs are rejected by shared validators with clear Chinese messages (empty/negative
  name or macros; non-finite quantity; invalid gramsPerUnit).
- Ad-hoc foods drop unknown fields (incl. `ownerOpenid`); they are usable immediately and are
  not written to CloudBase.
- A food carries `nutritionMeta.source` + `nutritionMeta.version`; seed = `curated_mvp_seed`,
  ad-hoc = `user_entered`.
- The add-meal page makes no `mealApi` call and writes no `meals` record (scope boundary).

## M3 — Manual meal logging ⬜
**Goal:** the primary end-to-end workflow — combine foods into a meal and persist it.
**Scope:** combine **multiple food items** into a meal; **meal type and date**; server-side
validation and recomputation; **save and reload meals** via `mealApi`.
**Acceptance:**
- A meal saves and reloads identically; `totals` equal the confirmed-item sum.
- Server overwrites any client-sent totals (trust boundary verified).
- Works with AI disabled.

## M4 — Daily history, edit & delete ⬜
**Goal:** review and maintain records.
**Scope:** query meals by (owner, profile, date); group by slot; per-day totals; edit and
delete flows (`mealApi.update` / `delete`) with confirm dialog.
**Acceptance:**
- Changing date/member shows the correct meals and totals.
- Edit and delete update daily totals correctly.

## M5 — Saved foods & recipes ⬜
**Goal:** reuse and simple recipes.
**Scope:** mark foods as saved; manage saved list; define recipes (ingredients → per-serving
nutrition) and add a recipe serving to a meal.
**Acceptance:**
- A saved food is reusable across meals.
- A recipe's per-serving nutrition equals its computed ingredient sum ÷ servings.

## M6 — Photo upload ⬜
**Goal:** attach a photo to a meal.
**Scope:** capture/select photo; upload to CloudBase Storage; store `photoFileId`; private
access rules.
**Acceptance:**
- A meal can carry a photo; only the owner can read it; upload failure doesn't block manual
  save.

## M7 — AI suggestions (mock) ⬜
**Goal:** end-to-end AI-assisted flow, mock provider only.
**Scope:** `aiAnalyze` returns mock suggestions; client confirm/correct UX; confirmed items
become `MealItem`s; `ai_analyses` record persisted; recompute nutrition from confirmed
input.
**Acceptance:**
- Suggestions never count until confirmed.
- Disabling/failing AI drops cleanly to manual with no loss of function.
- Final nutrition always comes from the shared layer, never raw AI numbers.

## M8 — Real AI provider ⬜
**Goal:** swap mock for a real provider behind the same interface.
**Scope:** implement a concrete provider selected by `AI_PROVIDER`; secrets only in
CloudBase function env vars; timeouts + graceful failure.
**Acceptance:**
- Switching providers requires **no client change**.
- No secret appears in the repo or client bundle.
- Provider errors degrade to manual/mock.

---

## Cross-cutting definition of done (every milestone)
- TypeScript strict passes; `npm run validate` green.
- Shared schemas/validation used on both client and server for touched entities.
- No secrets/env IDs committed; dev/prod separation respected.
- Manual workflow remains fully functional regardless of AI state.
