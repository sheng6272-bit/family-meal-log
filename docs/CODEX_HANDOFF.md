# CODEX_HANDOFF.md - Family Meal Log MVP

> **Last verified date:** 2026-07-15
> **Last verified branch:** `feature/mvp-completion`
> **Last verified master commit:** `d39e520` (`fix: handle CRLF in env ignore validation (#2)`)
> **Current verified integration base:** `feature/mvp-completion` @ `9faf440`

This file is a living project-state document. `AGENTS.md` holds the permanent
rules; this handoff records what is actually verified right now.

---

## 1. Repository identity

- **Repository URL:** https://github.com/sheng6272-bit/family-meal-log.git
- **Default branch:** `master`
- **Main stack:** Native WeChat Mini Program (TypeScript strict) + Tencent CloudBase
- **Package manager:** `npm`
- **Primary validation command:** `npm run validate`
- No real CloudBase env IDs, appid, tokens, or `openid` are committed.

## 2. Verified branch and PR state

Verified from local Git plus the GitHub connector on 2026-07-15:

- `master` -> `d39e520`, tracks `origin/master`
- `feature/m2-food-catalog-portions` -> `28f2916`, tracks `origin/feature/m2-food-catalog-portions`
- `chore/codex-agent-guidance` -> `71dd76d`, doc-only branch that introduced `AGENTS.md` and the original handoff
- `feature/mvp-completion` -> local integration branch based on verified M2, plus the guidance docs

GitHub PR state:

- PR `#1` (`feat: add identity and family profile management`) is **merged**
- PR `#2` (`fix: handle CRLF in env ignore validation`) is **merged**
- No open PR is currently confirmed for `feature/m2-food-catalog-portions`
- No draft PR is currently confirmed for `feature/mvp-completion`

## 3. Milestone status

- **M0 - Foundation & shell:** done and merged to `master`
- **M1 - Identity & family profiles:** done and merged to `master`
- **M2 - Food catalog & portion units:** implemented, verified, **not merged to `master`**
- **M3-M8:** not implemented yet on this handoff snapshot

Important nuance for M2:

- The original M2 implementation lives on `feature/m2-food-catalog-portions`
- The current working branch `feature/mvp-completion` starts from that M2 lineage
- During verification, one real defect was found and fixed:
  - `miniprogram/app.ts` used a hard import of the git-ignored `miniprogram/config/env.local.ts`
  - that made `npm run validate` fail in a clean clone/worktree
  - the fix now loads local overrides only when the file exists, otherwise the app stays in the documented offline shell mode
- Validation coverage was extended so this clean-checkout guarantee is tested

## 4. Verified validation baselines

| Lineage | Verified | Command | Result |
|---------|----------|---------|--------|
| `master` (M0+M1) | 2026-07-15 | `npm run validate` | **91 passed, 0 failed** |
| `feature/m2-food-catalog-portions` (reported historical baseline) | 2026-07-14 | `npm run validate` | **151 passed, 0 failed** |
| `feature/mvp-completion` (verified M2 integration baseline) | 2026-07-15 | `npm run validate` | **152 passed, 0 failed** |

Notes:

- `npm run validate` = `npm run typecheck` + `npm run test`
- `npm run test` = `npm run build:shared` + `node scripts/validate.mjs`
- Manual WeChat DevTools and phone checks remain **pending** and must not be claimed as passed

## 5. Verified implemented architecture

### M0 + M1 on `master`

- Shared nutrition and validation live in `shared/`
- `login` derives identity server-side and never returns `openid`
- `profileApi` manages family profiles with owner scoping
- `users.defaultFamilyProfileId` is the single source of truth for the default profile
- Request-level profile idempotency is best-effort, not atomic

### M2 on the verified integration base

- Seed catalog in `shared/data/system-foods.ts`
- Food search in shared logic, consumed by the Mini Program via generated `miniprogram/lib/shared/`
- Session-only ad-hoc foods
- Generic `g` and `ml` units plus food-specific units
- Portion-to-gram conversion and live single-food nutrition preview
- Nutrition provenance metadata on foods
- No meal persistence
- No `mealApi` create/list/get/update/delete usage from `add-meal`
- No AI dependency in the M2 `add-meal` flow

## 6. Current deployment/runtime facts

Verified facts only:

- `login` source exists and is complete for M1
- `profileApi` source exists and is complete for M1
- `mealApi` is still a placeholder at this point
- `aiAnalyze` is mock-only at this point
- `npm run build:shared` packages the shared runtime into cloud functions and `miniprogram/lib/shared/`

Not verified here:

- WeChat DevTools compile/run
- Cloud function upload status
- Real device behavior
- CloudBase collections/indexes/security rules in an actual environment

## 7. Known hazards and lessons learned

- **CRLF safety:** validator regexes must stay CRLF-safe
- **CloudBase init order:** do not call `cloud.database()` before `cloud.init()`
- **Generated runtime:** always rebuild shared runtime before deploy or Mini Program packaging
- **Git ignore discipline:** never commit `shared/dist/`, `cloudfunctions/*/lib/shared/`, or `miniprogram/lib/shared/`
- **Client runtime packaging:** Mini Program runtime logic must come from the generated `miniprogram/lib/shared/` copy, not direct cross-root runtime imports
- **No hard import of `env.local.ts`:** git-ignored local override files may be absent in clean clones/worktrees
- **Manual testing is human-only:** no headless claim of DevTools or phone success is allowed

## 8. Recommended next step from this snapshot

The repository is ready to continue on `feature/mvp-completion`:

1. Keep using `feature/mvp-completion` as the long-lived integration branch
2. Push it and open one draft PR against `master`
3. Continue with M3 implementation on top of the verified M2 baseline
4. Keep updating this handoff after each milestone checkpoint

## 9. Human-only actions still expected later

- Configure local/dev CloudBase environment IDs in the git-ignored override file
- Deploy or redeploy cloud functions from WeChat DevTools
- Run the manual checklist in DevTools and on a real phone
- Add any future AI provider secret only in cloud-function environment variables
- Merge the final PR

## 10. Update protocol

After each milestone checkpoint:

- Update the verified date and branch
- Update the validation counts
- Update milestone status
- Record any newly found hazards
- Keep branch and PR state current
- Record only verified deployment facts
