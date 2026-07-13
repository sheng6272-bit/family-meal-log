# Development Plan — Family Meal Log MVP

Small, verifiable milestones. Each has a clear **goal**, **scope**, and **acceptance
criteria**. Manual logging is prioritized; AI is added last and always optional.

Legend: ✅ done · ⬜ planned

---

## M0 — Foundation & shell ✅ (this task)
**Goal:** a clean, consistent repository foundation and a minimal compilable shell.
**Scope:** directory structure; README + docs (requirements, architecture, data model,
flows, plan); shared schemas/validation/nutrition; config templates (no secrets); minimal
Mini Program shell (app + home + add-meal placeholders); cloud-function placeholders;
validation command.
**Acceptance:**
- `npm run validate` passes (type-check + shared build + structural/logic smoke tests).
- No secrets, env IDs, or appid committed.
- Home and add-meal pages compile and navigate; app runs in offline shell mode.

## M1 — Identity & family profiles ⬜
**Goal:** real WeChat identity and family-member management.
**Scope:** `login` upserts `users`; create/list/select/edit family profiles; active-profile
state; first-run "create first profile".
**Acceptance:**
- Login returns a stable server-derived openid; a `users` doc exists.
- User can create ≥ 2 profiles, switch active, and set a default.
- Access is owner-scoped; no client-supplied openid is trusted.

## M2 — Food catalog & portions ⬜
**Goal:** foods and portion→gram conversion in the UI.
**Scope:** seed a small system `foods` set; food search/pick; portion units (generic +
food-specific); quantity input; live item nutrition via shared layer.
**Acceptance:**
- Selecting a food + unit + quantity shows correct grams and calories/macros matching the
  shared nutrition tests.
- Invalid inputs are rejected by shared validators with clear messages.

## M3 — Manual meal logging ⬜
**Goal:** the primary end-to-end workflow.
**Scope:** build a meal (slot + items), live subtotals, save via `mealApi.create` with
server-side re-validation and totals recomputation.
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
