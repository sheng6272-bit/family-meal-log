# Family Meal Log MVP

A native WeChat Mini Program for family meal logging, built with TypeScript strict mode and
Tencent CloudBase.

The MVP in this branch is complete through **M8**:

- trusted WeChat identity and family-member profiles,
- bundled food catalog plus session ad-hoc foods,
- manual multi-item meal logging,
- daily history with edit and delete,
- saved foods and reusable recipes,
- meal photo upload to CloudBase Storage,
- mock AI suggestion flow with explicit user confirmation,
- real-provider implementation behind the same provider-neutral AI interface.

Manual logging remains the primary path. AI is optional, advisory, and never the final source
of nutrition values.

## Current scope

Implemented now:

1. `login`, `profileApi`, `mealApi`, and `aiAnalyze` cloud functions.
2. Owner-scoped family profiles with default-profile resolution.
3. Food search, portion units, grams conversion, and live nutrition preview.
4. Meal create, list, get, update, and delete with server-side recomputation.
5. Saved foods and recipe management.
6. Photo upload and `photoFileId` persistence on meals.
7. Mock AI and real AI provider support selected by `AI_PROVIDER`.
8. A full automated repository gate in `npm run validate`.

Still human-only:

1. CloudBase collection/index creation.
2. Cloud function deployment.
3. DevTools and phone verification.
4. Real provider secret configuration.
5. Draft PR creation if GitHub integration permissions remain restricted.

See [docs/FINAL_HUMAN_RUNBOOK.md](./docs/FINAL_HUMAN_RUNBOOK.md) for the ordered final session.

## Local setup

```bash
npm ci
npm run validate
```

Then open the repository in WeChat DevTools.

Important local-only config:

- `project.private.config.json`
- `miniprogram/config/env.local.ts`
- cloud-function environment variables for real AI

None of those files or secrets should be committed.

## Validation

```bash
npm run typecheck
npm run build:shared
npm test
npm run validate
git diff --check
```

Current automated baseline on `feature/mvp-completion`:

- `npm run validate` -> **142 passed, 0 failed**

## Milestones

| Milestone | Status | Summary |
|-----------|--------|---------|
| M0 | done | repository shell, docs, shared runtime, validation gate |
| M1 | done | trusted identity, family profiles, default-profile flow |
| M2 | done | food catalog, portion units, live preview |
| M3 | done | manual meal logging with trusted persistence |
| M4 | done | daily history, edit, delete |
| M5 | done | saved foods and recipes |
| M6 | done | meal photo upload |
| M7 | done | mock AI suggestion and confirmation flow |
| M8 | done | real provider behind the neutral AI interface |

Authoritative milestone scope is in [docs/DEVELOPMENT_PLAN.md](./docs/DEVELOPMENT_PLAN.md).

## Repository layout

```text
miniprogram/                 Native WeChat Mini Program
  pages/                     UI pages only
  services/                  client service boundary
  lib/shared/                generated shared runtime (git-ignored)

cloudfunctions/              CloudBase trusted boundary
  login/
  profileApi/
  mealApi/
  aiAnalyze/

shared/                      single source of truth
  data/system-foods.ts
  nutrition.ts
  validation.ts
  repository*.ts
  services/

scripts/
  build-shared.mjs
  validate.mjs

docs/
  ARCHITECTURE.md
  DATA_MODEL.md
  USER_FLOWS.md
  SECURITY.md
  DEVELOPMENT_PLAN.md
  MANUAL_TEST_CHECKLIST.md
  FINAL_HUMAN_RUNBOOK.md
  CODEX_HANDOFF.md
```

## Documentation index

- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
- [docs/DATA_MODEL.md](./docs/DATA_MODEL.md)
- [docs/USER_FLOWS.md](./docs/USER_FLOWS.md)
- [docs/SECURITY.md](./docs/SECURITY.md)
- [docs/DEVELOPMENT_PLAN.md](./docs/DEVELOPMENT_PLAN.md)
- [docs/MANUAL_TEST_CHECKLIST.md](./docs/MANUAL_TEST_CHECKLIST.md)
- [docs/FINAL_HUMAN_RUNBOOK.md](./docs/FINAL_HUMAN_RUNBOOK.md)
- [docs/CODEX_HANDOFF.md](./docs/CODEX_HANDOFF.md)
