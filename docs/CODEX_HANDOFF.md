# CODEX_HANDOFF.md - Family Meal Log MVP

> Last verified date: 2026-07-15
> Last verified branch: `feature/mvp-completion`
> Last verified master commit: `d39e520` (`fix: handle CRLF in env ignore validation (#2)`)
> Current verified integration branch: `feature/mvp-completion`

This file is the current verified handoff snapshot. `AGENTS.md` holds permanent operating rules.

## 1. Repository identity

- Repository URL: https://github.com/sheng6272-bit/family-meal-log.git
- Default branch: `master`
- Stack: Native WeChat Mini Program + TypeScript strict + Tencent CloudBase
- Primary validation command: `npm run validate`

## 2. Verified branch state

Verified on 2026-07-15:

- `master` -> `d39e520`
- `feature/m2-food-catalog-portions` -> `28f2916`
- `chore/codex-agent-guidance` -> `71dd76d`
- `feature/mvp-completion` -> integration branch based on verified M2 plus guidance docs

GitHub status already confirmed earlier in the thread:

- PR `#1` merged
- PR `#2` merged
- no open PR currently confirmed for `feature/mvp-completion`

## 3. Milestone status

- M0: done and merged to `master`
- M1: done and merged to `master`
- M2: implemented and verified, not yet merged to `master`
- M3: implemented and verified on `feature/mvp-completion`
- M4-M8: not implemented yet

## 4. Validation baselines

| Lineage | Date | Command | Result |
|---------|------|---------|--------|
| `master` (M0+M1) | 2026-07-15 | `npm run validate` | 91 passed, 0 failed |
| `feature/m2-food-catalog-portions` historical baseline | 2026-07-14 | `npm run validate` | 151 passed, 0 failed |
| `feature/mvp-completion` verified M2 baseline | 2026-07-15 | `npm run validate` | 152 passed, 0 failed |
| `feature/mvp-completion` current M3 checkpoint | 2026-07-15 | `npm run validate` | 176 passed, 0 failed |

Manual DevTools and real-device checks remain pending until a human runs them.

## 5. Verified implementation snapshot

M2 baseline:

- bundled system food seed catalog
- shared food search
- session-only ad-hoc foods
- generic plus food-specific portion units
- single-item live nutrition preview

M3 additions:

- shared `meal-service`
- `Meal.requestId`
- `MealItem.foodSnapshot`
- `MealItem.portionGramsPerUnit`
- `mealApi.create`
- `mealApi.get`
- multi-item draft meal UI in `add-meal`
- server recomputation of item nutrition and meal totals
- client-safe meal DTOs with no `ownerOpenid` and no `requestId`

## 6. Important verified facts

- `shared/` remains the single source of truth for nutrition and validation.
- `miniprogram/app.ts` no longer hard-imports the git-ignored `env.local.ts`.
- `mealApi` is no longer a placeholder; M3 create/get is implemented.
- `aiAnalyze` is still mock-only and non-essential.
- `npm run build:shared` packages the shared runtime into cloud functions and
  `miniprogram/lib/shared/`.

## 7. Known hazards and lessons

- CRLF-sensitive validation patterns need care.
- Do not call `cloud.database()` before `cloud.init()`.
- Rebuild shared runtime before deploy or Mini Program packaging.
- Never commit generated `shared/dist/`, `cloudfunctions/*/lib/shared/`, or
  `miniprogram/lib/shared/`.
- Meal create replay is currently **best-effort**, not atomic. It uses
  `(ownerOpenid, requestId)` lookup before/after insert and should be hardened with a unique
  composite index later.
- Manual testing is human-only and must not be fabricated.

## 8. Recommended next step

Continue on `feature/mvp-completion` and implement M4:

1. day-history query flow,
2. edit/delete behavior,
3. per-day totals,
4. docs and checklist updates,
5. fresh validation run.

## 9. Human-only actions still expected later

- Configure local/dev CloudBase env ids in the git-ignored override file.
- Upload changed cloud functions from WeChat DevTools.
- Run the manual checklist in DevTools and on a real phone.
- Add any future AI provider secret only in cloud-function environment variables.
- Merge the final PR.
