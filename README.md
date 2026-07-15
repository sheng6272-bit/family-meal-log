# Family Meal Log MVP (家庭餐食记录)

A family-oriented food-intake logging **WeChat Mini Program** built on **Tencent CloudBase**.
This repository currently includes the verified milestones **M0 foundation**, **M1 identity and
family profiles**, **M2 food catalog and portion units**, and **M3 manual meal logging**.
The add-meal page now supports multi-item drafting plus server-validated **save and reload** for
manual meals. Daily history/edit/delete (M4) and later milestones are still pending.

---

## 1. Project purpose

Help a household record what each family member eats, with reliable **manual** entry of foods
and portions, automatic **calorie and macronutrient** calculation, and a simple **daily intake**
view. Photo-based AI food recognition is planned for later milestones; the app must remain
**fully usable without any AI service**.

## 2. Current MVP scope

Implemented now:

1. WeChat user identity.
2. Multiple family-member profiles.
3. Food catalog search with bundled seed foods.
4. Generic and food-specific portion units.
5. Single-item live grams + nutrition preview.
6. Manual multi-item meal drafting.
7. Manual meal save and immediate reload through `mealApi`.
8. Shared nutrition logic enforced on both client and server.

Still out of scope in the current branch:

1. Daily history browsing, edit, and delete.
2. Saved foods and recipes.
3. Photo upload.
4. AI suggestions and real AI providers.
5. Payments, social features, or medical advice.

## 3. Required software

| Tool | Version | Purpose |
|------|---------|---------|
| WeChat DevTools | latest stable | Build/run the Mini Program, deploy cloud functions |
| Node.js | >= 18 | Tooling, type-check, validation script |
| npm | >= 9 | Dependency management |
| Tencent CloudBase environment | 1 dev + 1 prod | Database, storage, cloud functions |
| Git | recent | Version control |

## 4. Local setup

```bash
# 1. Install dependencies from the tracked lockfile
npm ci

# 2. Configure your WeChat appid locally (never commit the real one)
cp project.private.config.example.json project.private.config.json

# 3. Configure CloudBase environment IDs locally (never commit them)
cp miniprogram/config/env.local.example.ts miniprogram/config/env.local.ts

# 4. Run the repository gate
npm run validate
```

Then open the project folder in **WeChat DevTools**. The Mini Program runs in an **offline shell
mode** until a CloudBase env ID is configured; bundled food search and preview still work there.

## 5. Validation

```bash
npm run validate
npm run typecheck
npm test
```

`scripts/validate.mjs` checks structural consistency, secret hygiene, and the shared runtime
packaging. It also exercises:

- **M1** identity/profile behavior: idempotent login, owner isolation, default persistence.
- **M2** food-catalog behavior: seed integrity, search, portion units, ad-hoc foods, preview.
- **M3** meal behavior: server recomputation, owner scoping, save/reload, request-id replay,
  and client-safe DTOs.

`scripts/build-shared.mjs` compiles `shared/` and copies the runtime into cloud functions and
`miniprogram/lib/shared/`. Run it before deploying cloud functions or packaging the Mini Program.

## 6. Milestones

| # | Milestone | Status | Outcome |
|---|-----------|--------|---------|
| M0 | Foundation and shell | done | Repo structure, docs, shared layer, validation gate |
| M1 | Identity and family profiles | done | Server-trusted login, profile UI, active-profile state |
| M2 | Food catalog and portion units | done | Seed + ad-hoc foods, units, gram conversion, live preview |
| M3 | Manual meal logging | done | Multi-item draft meal, date/meal type, server-validated save/reload |
| M4 | Daily history | planned | Browse meals by day, edit, delete |
| M5 | Saved foods and recipes | planned | Reusable foods and simple family recipes |
| M6 | Photo upload | planned | CloudBase storage upload workflow |
| M7 | AI suggestions (mock) | planned | Optional AI flow with confirm/correct UX |
| M8 | Real AI provider | planned | Swap mock for a real provider behind the same interface |

Detailed scope and acceptance criteria live in
[`docs/DEVELOPMENT_PLAN.md`](./docs/DEVELOPMENT_PLAN.md).

## 7. Repository layout

```text
.
├── README.md
├── docs/                     # product and engineering docs
├── miniprogram/              # WeChat Mini Program (TypeScript)
│   ├── config/               # environment config (no secrets) and labels
│   ├── pages/                # home, add-meal, profiles, profile-edit
│   ├── services/             # cloud wrapper, auth, profile, session, food-catalog, meal, AI adapter
│   └── lib/shared/           # GENERATED shared runtime (git-ignored)
├── cloudfunctions/           # CloudBase cloud functions
│   ├── login/                # M1 server-trusted identity upsert
│   ├── profileApi/           # M1 list/create/update/setDefault/get
│   ├── mealApi/              # M3 create/get; M4 adds update/delete/list
│   ├── aiAnalyze/            # mock AI provider scaffold
│   └── <fn>/lib/shared/      # GENERATED shared runtime (git-ignored)
├── shared/                   # source of truth for schemas, validation, nutrition, services
│   └── data/system-foods.ts  # bundled M2 seed catalog + portion units
├── scripts/                  # build-shared.mjs and validate.mjs
├── typings/                  # ambient TypeScript typings
└── project.config.json
```

## 8. Documentation index

- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md): app structure, trusted boundaries, packaging.
- [`docs/DATA_MODEL.md`](./docs/DATA_MODEL.md): entities, snapshots, indexes.
- [`docs/USER_FLOWS.md`](./docs/USER_FLOWS.md): current user journeys.
- [`docs/DEVELOPMENT_PLAN.md`](./docs/DEVELOPMENT_PLAN.md): milestone scope and acceptance.
- [`docs/SECURITY.md`](./docs/SECURITY.md): collections, indexes, security posture.
- [`docs/MANUAL_TEST_CHECKLIST.md`](./docs/MANUAL_TEST_CHECKLIST.md): DevTools/phone checks.
