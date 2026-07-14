# CODEX_HANDOFF.md — Family Meal Log MVP

> **Last verified date:** 2026-07-14
> **Last verified branch:** chore/codex-agent-guidance (created from `master` at `d39e520`)
> **Last verified master commit:** `d39e520` (fix: handle CRLF in env ignore validation (#2))
> **Feature branch verified separately:** `feature/m2-food-catalog-portions` @ `28f2916` (151 passed)
>
> This file is a **living project-state document**, not a permanent rule set. Update it
> after every merged milestone: refresh the date, master SHA, milestone status, test counts,
> and deployment state. AGENTS.md holds the permanent rules.

---

## 1. Repository identity

- **Repository URL:** https://github.com/sheng6272-bit/family-meal-log.git
- **Default branch:** `master`
- **Main stack:** Native WeChat Mini Program (TypeScript strict) + Tencent CloudBase
  (cloud functions + document DB + storage). No UI framework.
- **Package manager:** `npm` (lockfile `package-lock.json` is tracked; use `npm ci`).
- **Primary validation command:** `npm run validate` (typecheck → build:shared → `node scripts/validate.mjs`).
- No real CloudBase env IDs, appid, tokens, or `openid` are present in the repo.

## 2. Current project status

- **M0 — Foundation & shell:** ✅ done and merged to `master`.
- **M1 — Identity & family profiles:** ✅ done and merged to `master`.
- **M2 — Food catalog & portion units:** ✅ **implemented**, but **NOT merged to `master`**.
  - Lives on branch `feature/m2-food-catalog-portions` (4 commits, HEAD `28f2916`).
  - **Pushed** to `origin` (remote ref exists).
  - Automated validation passes (151 passed / 0 failed, verified 2026-07-14).
  - **Pending:** PR creation/review, and WeChat DevTools + phone manual verification.
  - M2 must NOT be reported as "on `master`" until merged.
- **M3–M8:** ⬜ planned, not started.

Open branches / PRs:
- Unmerged feature branch: `feature/m2-food-catalog-portions` (remote present, no PR confirmed).
- No PR was confirmed to exist (no `gh` in the environment; PR creation is a human/CI step).
- This handoff lives on `chore/codex-agent-guidance` (not yet pushed).

## 3. Verified validation baseline

| Lineage | Verified | Command | Result |
|---------|----------|---------|--------|
| `master` (M0+M1) | 2026-07-14 | `npm run validate` | **91 passed, 0 failed** |
| `feature/m2-food-catalog-portions` (M0+M1+M2) | 2026-07-14 | `npm run validate` | **151 passed, 0 failed** |

- Test command: `npm run validate` (= `npm run typecheck` + `npm run build:shared` + `node scripts/validate.mjs`).
- Automated tests: GREEN on both lineages above.
- Manual / device tests: **PENDING** — WeChat DevTools compile + phone preview are human acceptance
  (see `docs/MANUAL_TEST_CHECKLIST.md`). Do not claim them passed.
- `git diff --check`: clean on both lineages.

## 4. Implemented architecture

**M0 (foundation, on `master`):**
- Repository structure, docs, shared schemas/validation/nutrition.
- Minimal compilable Mini Program shell (app + home + add-meal placeholders).
- `scripts/validate.mjs` structural + behaviour smoke tests.
- `scripts/build-shared.mjs` shared-runtime packaging.

**M1 (identity & family profiles, on `master`):**
- Server-derived WeChat identity (`login` cloud function upserts `users`, idempotent).
- `family_profiles` management via `profileApi` (list/create/update/setDefault/get).
- Active-profile resolution + local persistence (`resolveActiveProfile`).
- Best-effort request idempotency (`requestId` + `idempotency_keys` + UI in-flight guard).
- `login` and `profileApi` **source-complete and merged**; actual CloudBase upload is a
  human WeChat DevTools step (deployment state PENDING verification).
- `aiAnalyze` mock provider implemented (advisory only).

**M2 (food catalog & portion units, on `feature/m2-food-catalog-portions`):**
- Local curated food seed catalog (`shared/data/system-foods.ts`, ≥ 11 foods, offline-capable).
- Food search (`searchFoods`) + selection.
- Session-only ad-hoc foods (`createAdHocFood`, never persisted).
- Generic portion units (`g`, `ml`) + food-specific units; merged with food-specific first.
- Portion→gram conversion (`quantity × gramsPerUnit → grams`).
- Live single-food nutrition preview (kcal/protein/carb/fat, 1 decimal) — math in shared layer.
- Nutrition provenance metadata (`Food.nutritionMeta = { source, version }`).
- Client shared-runtime packaging (`miniprogram/lib/shared/`) so the Mini Program can
  `require` the shared food-catalog/portion services.
- **No meal persistence**: no `mealApi` call, no `meals` write, no AI dependency in `add-meal`.

## 5. Important architecture decisions

- `users.defaultFamilyProfileId` is the **single source of truth** for the default profile.
- `family_profiles` stores **no `isDefault`** field; the client DTO computes it.
- Profile **name is not a uniqueness key**; identical names are allowed.
- Profile create idempotency is **best-effort** (request-scoped + UI guard), not atomic;
  the atomic unique-index design is deferred to M3.
- `openid` is **never exposed to the client** (derived server-side only).
- The **shared nutrition layer** (`shared/nutrition.ts`) is the single source of nutritional truth.
- `Food.source` (business origin: system/user/recipe) is **distinct** from
  `Food.nutritionMeta.source` (provenance of the nutrition numbers). Seed = `curated_mvp_seed`;
  ad-hoc = `user_entered`; no external authority is claimed unless verified.
- Ad-hoc foods are **session-only** (not written to CloudBase in M2).
- `ml` uses a **1 g/ml MVP approximation** (water-like foods).
- M2 **does not write** `foods` or `meals`.
- Meal persistence belongs to **M3**.

## 6. Current deployed/runtime state

Verified facts only; deployment is a human action and NOT verifiable by a headless agent.

- **Cloud functions (source state):**
  - `login` — implemented (M1), merged to `master`. Deployment: **PENDING** (human WeChat DevTools upload).
  - `profileApi` — implemented (M1), merged to `master`. Deployment: **PENDING**.
  - `mealApi` — placeholder (routes only); real logic is M3.
  - `aiAnalyze` — mock provider implemented; real provider is M8.
- **Offline-capable** (no CloudBase needed): M2 `add-meal` food catalog + nutrition preview
  (seed bundled); identity/profile shell mode with a clear "未配置云环境" notice.
- **Requires CloudBase** (deployed functions + configured env): real identity derivation,
  profile persistence, and (later) meal save/reload.
- **Requires WeChat DevTools re-upload** after any cloud-function change: run
  `npm run build:shared` first so `lib/shared/` is regenerated into each function.
- Do NOT state that a function "is deployed" unless a human has confirmed the upload.

## 7. Current branch and PR state

Actual `git` output (2026-07-14):

```
$ git branch -vv
* chore/codex-agent-guidance       d39e520 fix: handle CRLF in env ignore validation (#2)
  feature/m2-food-catalog-portions 28f2916 [origin/feature/m2-food-catalog-portions] test(docs): extend validate.mjs with M2 checks; update docs for M2
  master                           d39e520 [origin/master] fix: handle CRLF in env ignore validation (#2)

$ git ls-remote --heads origin
28f291622181e45ef0565d6b679b2388b8ac48a5  refs/heads/feature/m2-food-catalog-portions
d39e5202b042fb91ae3190afe969149311ad3a24  refs/heads/master
```

- **master:** `d39e520`, tracks `origin/master`, up to date.
- **feature/m2-food-catalog-portions:** `28f2916`, tracks `origin/feature/m2-food-catalog-portions`
  (pushed). NOT merged. NO PR confirmed.
- **chore/codex-agent-guidance:** `d39e520`, NEW, NOT yet pushed (this handoff + AGENTS.md).
- **M2 PR:** none confirmed.
- **This handoff's PR:** none yet (will be the `chore/codex-agent-guidance` PR, base `master`).

## 8. Next recommended actions (in priority order)

1. **Create or review the M2 PR** (`base: master`, `head: feature/m2-food-catalog-portions`).
2. **Run the M2 manual tests** in WeChat DevTools (`docs/MANUAL_TEST_CHECKLIST.md`, section C).
3. **Fix** anything found during manual testing.
4. **Merge M2 to `master`** once validation + manual checks pass.
5. **Pull** the updated `master` (`git pull --ff-only origin master`).
6. **Delete** the merged `feature/m2-food-catalog-portions` branch.
7. **Only then start M3** — do not begin M3 while M2 is unmerged or unverified.

## 9. M3 scope preview (from DEVELOPMENT_PLAN.md — preview only, not an implementation guide)

- Combine **multiple food items** into one meal.
- Capture **meal type** (breakfast/lunch/dinner/snack) and **local date** (`YYYY-MM-DD`).
- **Server-side validation** and **server recomputation** of `totals` (client totals untrusted).
- **`mealApi` save / reload** (create/list/get/update/delete).
- Stronger **atomic idempotency** if planned (promote `idempotency_keys` composite index to unique).

**M3 must NOT pre-include M4+ work:** daily history browse / edit / delete (M4), saved foods &
recipes (M5), photo upload (M6), AI suggestions (M7), real AI provider (M8).

## 10. Known hazards and lessons learned

- **Windows CRLF:** line-ending conversion can break secret/env-ignore regex checks. The
  validator tolerates CRLF (see `d39e520`). Keep regex CRLF-safe.
- **`cloud.database()` ordering:** do NOT call `cloud.database()` at module top level before
  `cloud.init()` in a cloud function; init first.
- **Shared runtime must be generated before deploy:** run `npm run build:shared` so each
  function (and `miniprogram/lib/shared/`) gets the current `lib/shared/`.
- **Generated dirs are git-ignored:** `shared/dist/`, `cloudfunctions/*/lib/shared/`,
  `miniprogram/lib/shared/`. Never commit them; edit `shared/*.ts` instead.
- **Mini Program cannot reliably import `shared` source outside `miniprogramRoot`** — hence the
  compiled runtime is copied to `miniprogram/lib/shared/` and consumed via `require`.
- **GitHub integration may be limited in the agent environment:** `gh` is not installed and
  pushes may need a token; do not fabricate a PR link — keep the branch and give the compare URL.
- **Manual WeChat tests cannot be faked by a headless agent.** They are human acceptance.

## 11. Human-only actions (keep these for the user)

- First GitHub / Codex authorization & token setup.
- WeChat DevTools compile + Network/Console inspection.
- Phone preview testing.
- CloudBase **production deployment** approval.
- Secret / env-ID configuration.
- Final **PR merge**.

Everything else (scaffolding, implementation, tests, docs, branch management, PR draft) should
be done autonomously by the agent.

## 12. Handoff update protocol (after each merged milestone)

- Update the **Last verified date** and **Last verified commit**.
- Update **milestone status** (mark done only after merge + green validation).
- Update the **verified test counts**.
- Update **deployment state** (mark deployed only if a human confirmed the upload).
- Clear resolved blockers; record any new ones.
- State the **next milestone** explicitly.
- Remove stale branch/PR state so the file never points at a dead branch or a closed PR.
