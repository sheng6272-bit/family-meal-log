# Family Meal Log MVP (家庭饮食记录)

A family-oriented food-intake logging **WeChat Mini Program** built on **Tencent CloudBase**.
This repository currently contains the **project foundation (M0), identity & family profiles (M1),
and the food catalog & portion-units milestone (M2)**. Manual meal saving (M3) and later
milestones are not yet implemented — the add-meal page shows a live nutrition preview but does
**not** persist a meal.

---

## 1. Project purpose

Help a household record what each family member eats, with reliable **manual** entry of
foods and portions, automatic **calorie and macronutrient** calculation, and a simple
**daily intake** view. Photo-based AI food recognition is planned for a later phase; the
architecture is prepared for it, but the app must remain **fully usable without any AI service**.

## 2. MVP scope (v0.1)

The MVP will eventually support:

1. WeChat user identity.
2. Multiple family-member profiles.
3. Breakfast / lunch / dinner / snack records.
4. Manual food-item entry.
5. Portion units and gram conversion.
6. Calories, protein, carbohydrate and fat calculation.
7. Meal-photo upload.
8. AI food suggestions via a **provider-neutral adapter** (mock first).
9. User correction and confirmation of AI suggestions.
10. Daily meal history and daily totals.
11. Saved foods and simple family recipes.
12. CloudBase database, storage and cloud functions.

**Primary reliable workflow = manual logging.** AI is always advisory and optional.

### Explicitly out of scope
Payments, social feeds, medical/disease advice, commercial features, a full design system,
and treating AI output as nutritional truth. See `docs/PRODUCT_REQUIREMENTS.md`.

## 3. Required software

| Tool | Version | Purpose |
|------|---------|---------|
| WeChat DevTools (微信开发者工具) | latest stable | Build/run the Mini Program, deploy cloud functions |
| Node.js | >= 18 | Tooling, type-check, validation script |
| npm | >= 9 | Dependency management |
| Tencent CloudBase environment | 1 dev + 1 prod | Database, storage, cloud functions |
| Git | any recent | Version control |

## 4. Local setup

```bash
# 1. Install dev dependencies (TypeScript + WeChat typings)
npm install

# 2. Configure your WeChat appid locally (never commit the real one)
cp project.private.config.example.json project.private.config.json
#    then edit "appid" in project.private.config.json

# 3. Configure CloudBase environment IDs locally (never commit them)
cp miniprogram/config/env.local.example.ts miniprogram/config/env.local.ts
#    then set your dev/prod env IDs, and call applyEnvOverrides(...) in app.ts

# 4. Validate the foundation (type-check + build shared + smoke tests)
npm run validate
```

Then open the project folder in **WeChat DevTools**. The Mini Program runs in an
**offline shell mode** until a CloudBase env ID is configured — manual navigation still works.

## 5. Environment setup

- **Secrets policy:** no API keys, no real CloudBase environment IDs, and no WeChat appid
  are committed. Copy the `*.example.*` templates to local, git-ignored files.
- **Dev vs prod:** selected in `miniprogram/config/env.ts` (`ACTIVE_ENV`) and injected via a
  local override or your build pipeline. See `docs/ARCHITECTURE.md`.
- **AI secrets** (future): stored only in the CloudBase **cloud-function environment
  variables**, never on the client and never in this repo. `AI_PROVIDER=mock` by default.

See `.env.example` for the full list of configurable values.

## 6. Validation

```bash
npm run validate     # typecheck + build shared + smoke tests
npm run typecheck    # tsc --noEmit across miniprogram + shared
npm test             # build shared + run scripts/validate.mjs
```

`scripts/validate.mjs` checks structural consistency (files, page references, cloud
functions, secret hygiene) and exercises the shared nutrition + validation layer, the **M1
identity/profile logic** (idempotent login, owner isolation, default persistence,
shared-runtime packaging), **and the M2 food-catalog logic** (seed integrity, search, portion
units, preview calculation, ad-hoc foods, and M2 scope-boundary guards). `scripts/build-shared.mjs`
compiles `shared/` and packages it into each cloud function's `lib/shared/` **and** the Mini
Program's `miniprogram/lib/shared/` — run it before deploying cloud functions or building the
Mini Program.

See `docs/SECURITY.md` for collections/indexes/security rules and `docs/MANUAL_TEST_CHECKLIST.md`
for device test steps.

## 7. Planned development milestones

| # | Milestone | Outcome |
|---|-----------|---------|
| M0 | **Foundation & shell** ✅ | Repo structure, docs, shared layer, compilable shell, validation |
| M1 | **Identity & family profiles** ✅ | Server-trusted login + `profileApi`; profiles UI; active-profile state; shared-runtime packaging |
| M2 | **Food catalog & portion units** ✅ | System + ad-hoc foods, portion units, gram conversion, single-food live nutrition (no meal saving) |
| M3 | Manual meal logging | Combine foods into a meal; meal type/date; save & reload |
| M4 | Daily history | Browse meals by day, edit, delete |
| M5 | Saved foods & recipes | Reusable foods and simple family recipes |
| M6 | Photo upload | CloudBase storage upload workflow |
| M7 | AI suggestions (mock) | End-to-end AI adapter with mock provider + confirm/correct UX |
| M8 | Real AI provider | Swap mock for a real provider behind the same interface |

Full breakdown with acceptance criteria: `docs/DEVELOPMENT_PLAN.md`.

> **M2 scope note:** M2 covers *only* the food catalog and portion units (single-food live
> nutrition). It does **not** save meals — `mealApi` create/list/get/update/delete, daily meal
> history, recipes, photo upload, and AI recognition are later milestones (M3–M8).

## 8. Repository layout

```
.
├── README.md
├── docs/                     # product & engineering docs (incl. SECURITY, MANUAL_TEST_CHECKLIST)
├── miniprogram/              # WeChat Mini Program (TypeScript)
│   ├── app.ts / app.json / app.wxss
│   ├── config/               # environment config (no secrets) + relation labels
│   ├── services/             # cloud wrapper, auth, profile, session, AI adapter, **food-catalog (M2)**
│   └── pages/                # home, add-meal (M2 food catalog), profiles, profile-edit
├── cloudfunctions/           # CloudBase cloud functions
│   ├── login/                # server-trusted identity upsert (M1)
│   ├── profileApi/           # list/create/update/setDefault/get (M1)
│   ├── mealApi/              # meal CRUD placeholder (M3)
│   └── aiAnalyze/            # mock AI provider (M7)
│   └── <fn>/lib/shared/      # GENERATED shared runtime (git-ignored)
├── shared/                   # schemas, validation, nutrition, user/profile/food-catalog services (source of truth)
│   └── data/system-foods.ts  # M2 curated offline seed catalog + portion units
├── shared/                   # schemas, validation, nutrition, user/profile services (source of truth)
├── scripts/                  # build-shared.mjs + validate.mjs
├── typings/                  # ambient TypeScript typings
├── project.config.json       # WeChat project config (non-secret)
├── tsconfig.json / package.json
└── .gitignore / .env.example
```

## 9. Documentation index

- `docs/PRODUCT_REQUIREMENTS.md` — objective, users, requirements, acceptance criteria
- `docs/ARCHITECTURE.md` — frontend, CloudBase, collections, functions, AI adapter, security
- `docs/DATA_MODEL.md` — entity schemas
- `docs/USER_FLOWS.md` — key user journeys
- `docs/DEVELOPMENT_PLAN.md` — milestones and acceptance criteria
