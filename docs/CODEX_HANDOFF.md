# CODEX_HANDOFF.md - Family Meal Log MVP

> Last updated: 2026-07-15
> Active branch: `feature/mvp-completion`
> Local `master`: `d39e520` (`fix: handle CRLF in env ignore validation (#2)`)
> Automated baseline: `npm run validate` -> **142 passed, 0 failed**

This file is the current engineering handoff snapshot. Permanent repository operating rules live
in `AGENTS.md`.

## 1. Repository identity

- Repository URL: https://github.com/sheng6272-bit/family-meal-log.git
- Default branch: `master`
- Stack: native WeChat Mini Program + TypeScript strict + Tencent CloudBase
- Trusted domain layer: `shared/`

## 2. Milestone status

- M0: done
- M1: done
- M2: done
- M3: done
- M4: done
- M5: done
- M6: done
- M7: done
- M8: done

## 3. Verified implementation snapshot

Implemented in the current branch:

- owner-scoped login and family profiles,
- bundled food catalog plus session ad-hoc foods,
- meal create/get/list/update/delete,
- daily history totals on home,
- saved foods and recipes,
- photo upload with optional persistence on meals,
- AI analyses stored separately from meals,
- AI-assisted confirmation flow in add-meal,
- provider-neutral real AI adapter selected by `AI_PROVIDER`,
- explicit `AI_PROVIDER=disabled` mode,
- atomic meal-create hardening path via duplicate-key recovery plus required unique meal replay index.

## 4. Important repository facts

- `shared/` remains the only implementation of validation, nutrition math, and meal/recipe rules.
- `mealApi` now owns:
  - meal CRUD,
  - saved-food CRUD,
  - recipe CRUD.
- `aiAnalyze` owns advisory AI analysis persistence only.
- `requestId` replay for meals depends on the human-created unique index
  `meals(ownerOpenid, requestId)`.
- Generated runtimes in `shared/dist/`, `miniprogram/lib/shared/`, and
  `cloudfunctions/*/lib/shared/` remain git-ignored.

## 5. Current GitHub state

- Branch already pushed: `feature/mvp-completion`
- Draft PR creation through the GitHub integration was blocked by permission error
  `Resource not accessible by integration`
- Use the compare/new PR URL if the integration remains blocked:
  `https://github.com/sheng6272-bit/family-meal-log/pull/new/feature/mvp-completion`

## 6. Remaining human-only work

Do not treat any of these as completed from this coding session:

- CloudBase collection creation,
- CloudBase index creation,
- database security-rule updates,
- storage permission verification,
- cloud-function deployment,
- WeChat DevTools compilation and runtime verification,
- second-account ownership testing,
- phone preview verification,
- real AI secret configuration,
- final PR creation/merge and branch cleanup.

These are all consolidated in [FINAL_HUMAN_RUNBOOK.md](./FINAL_HUMAN_RUNBOOK.md).

## 7. Recommended continuation point

If more work is needed later, start from:

1. `AGENTS.md`
2. `docs/DEVELOPMENT_PLAN.md`
3. `docs/FINAL_HUMAN_RUNBOOK.md`
4. `npm run validate`

The repo should be treated as a completed code MVP with pending human deployment and acceptance.
