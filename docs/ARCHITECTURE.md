# Architecture — Family Meal Log MVP

> Status: **M0 foundation ✅**, **M1 identity & family profiles ✅**, **M1.1 hardening ✅**
> (acceptance tests green — 91 checks).

## 1. High-level overview

```
+------------------------------------------------------+
|              WeChat Mini Program (client)            |
|  Pages (home, add-meal, profiles, profile-edit)      |
|  Services: cloud wrapper, auth, profile, session,    |
|           provider-neutral AI adapter                |
|  Config: env (no secrets), labels (relation UI)      |
|                     |                                |
|          import type / shared logic                  |
+---------------------|--------------------------------+
                      |  (wx.cloud.callFunction / DB / storage)
                      v
+------------------------------------------------------+
|                 Tencent CloudBase                    |
|  Cloud Functions: login, profileApi, mealApi, aiAnalyze
|  Database (document collections)                     |
|  Storage (meal photos, later)                        |
|  Function env vars: AI_PROVIDER, AI_API_KEY (secret) |
+------------------------------------------------------+
                      |  (future) provider-neutral call
                      v
              External AI provider (later)
```

Two independent layers of trust:
- **Nutrition layer** (`shared/nutrition.ts`) is the single source of nutritional truth.
- **AI layer** only produces *suggestions*; it can never write final nutrition directly.

## 2. Frontend architecture (Mini Program)

- **Native** WeChat Mini Program, **TypeScript**, strict mode.
- **Pages** (`miniprogram/pages/*`): thin view + interaction; no direct vendor/SDK calls.
  - `home` — active profile, daily totals placeholder, entry to manage profiles / onboarding.
  - `add-meal` — placeholder retained (meal logging is M3).
  - `profiles` — list / select / set default / create / edit (M1).
  - `profile-edit` — create/edit form (M1).
- **Services** (`miniprogram/services/*`):
  - `cloud.ts` — the only place that touches `wx.cloud`; initializes CloudBase and exposes
    `callFunction`. Degrades to offline mode when no env ID is configured.
  - `auth.ts` — wraps the `login` cloud function; returns only a non-sensitive internal id.
  - `profile.ts` — wraps the `profileApi` cloud function (list/create/update/setDefault/get).
  - `session.ts` — bootstraps identity + profiles, persists the active profile id locally,
    and resolves the active profile on launch (priority logic).
  - `ai/ai-adapter.ts` — provider-neutral entry `analyzeMealPhoto()`; routes to the
    `aiAnalyze` cloud function when available, else falls back to the local mock.
  - `ai/mock-provider.ts` — deterministic offline suggestions.
- **Config** (`miniprogram/config/env.ts`): environment selection; **no secrets**, blank
  CloudBase IDs by default; local override via `env.local.ts` (git-ignored) or CI injection.
- **Shared imports:** pages/services import **types** from `shared/*` using `import type`
  (erased at compile time, so no cross-root runtime bundling issue). Runtime shared logic
  (validation, profile/user services, repository contract) executes **inside the cloud
  functions** via the packaging step in §6. The client re-implements only tiny pure helpers
  (e.g. `resolveActiveProfile`) that mirror the shared version and are covered by tests.

## 3. CloudBase architecture

- **Database:** document collections (see §4 and `docs/DATA_MODEL.md`).
- **Storage:** meal photos, addressed by CloudBase `fileID` (M6).
- **Cloud functions:** the trusted boundary. They derive identity from the WeChat context,
  re-validate inputs with the shared validators/services, and recompute nutrition with the
  shared nutrition layer (meals, later). Clients are never trusted for identity or final totals.
- **Environments:** separate `dev` and `prod` CloudBase environments; the client selects one
  via `env.ts`. Secrets live only in function environment variables per environment.

## 4. Database collections

| Collection | Key fields | Notes / access |
|-----------|------------|----------------|
| `users` | `openid`, `defaultFamilyProfileId` | one per WeChat user; **server-only** identity; `defaultFamilyProfileId` is the sole default source of truth |
| `family_profiles` | `ownerOpenid`, `name`, `relation` | owner-only; M1 CRUD via `profileApi`; **no `isDefault` stored** |
| `idempotency_keys` | `ownerOpenid`, `operation`, `requestId`, `resultId` | request-level idempotency for create ops (M1.1) |
| `foods` | `name`, `per100g`, `source`, `ownerOpenid?`, `isSaved` | system foods readable; user foods owner-only (M2) |
| `portion_units` | `label`, `gramsPerUnit`, `foodId?` | generic + food-specific (M2) |
| `meals` | `ownerOpenid`, `familyProfileId`, `date`, `mealType`, `items[]`, `totals` | owner-only; indexed by (`ownerOpenid`,`familyProfileId`,`date`) (M3) |
| `recipes` | `ownerOpenid`, `name`, `servings`, `ingredients[]`, `perServing` | owner-only (M5) |
| `ai_analyses` | `ownerOpenid`, `photoFileId`, `provider`, `status`, `suggestions[]` | owner-only; advisory records (M7) |

Schemas are defined in `shared/types.ts`; see `docs/DATA_MODEL.md`.

**Required indexes (see `docs/SECURITY.md`):**
- `users.openid` — unique (single-user-per-openid; upsert idempotency).
- `family_profiles.ownerOpenid` + `family_profiles.createdAt` — owner-scoped list, createdAt ascending.
- `idempotency_keys.(ownerOpenid, operation, requestId)` — composite (**currently
  non-unique**); **promote to unique** at M3 to make the key insert the atomic idempotency
  gate (see §5b).

## 5. Cloud-function responsibilities

| Function | Responsibility (target) | v0.1 status |
|----------|-------------------------|-------------|
| `login` | Derive caller identity server-side (openid/unionid from context); upsert `users`; return client-safe `{id, defaultFamilyProfileId}`. **Never returns openid.** | **M1 ✅** |
| `profileApi` | Server-trusted family-profile management: `list` / `create` / `update` / `setDefault` / `get`. Owner-scoped; client-safe DTOs; input normalized + validated with shared logic. | **M1 ✅** |
| `mealApi` | Create/update/delete/list meals; **re-validate** with shared validators; **recompute** `totals` via shared nutrition; enforce per-user access. | placeholder (routes only) |
| `aiAnalyze` | Provider-neutral photo analysis; select provider by `AI_PROVIDER` env var; return advisory suggestions; never persist final nutrition. | mock provider implemented |

### profileApi dispatch (M1)

- `list` → caller's profiles, createdAt ascending, client-safe shape (no ownerOpenid); each
  DTO's `isDefault` is **computed** as `profile.id === user.defaultFamilyProfileId`.
- `create` → normalize + validate; ownership set server-side; first profile auto-default.
  Accepts a client `requestId` for **request-level idempotency** (see §5b); **no name-based
  deduplication** — the same owner may create profiles with identical names.
- `update` → editable fields only (`name`, `relation`); ownership enforced; unknown/ownership
  fields rejected.
- `setDefault` → sets **only** `users.defaultFamilyProfileId` after ownership check; never
  mutates any profile document.
- `get` → one owned profile (used by the client when needed); `isDefault` computed as above.

### 5b. Idempotency & default-profile single source of truth (M1.1)

**Best-effort request idempotency（尽力式请求幂等）.** Profile create uses *client in-flight
protection plus server-side request replay handling*: the client emits a stable `requestId`
per edit session; the server records `(ownerOpenid, operation='create', requestId)` in
`idempotency_keys` and replays the original result on a repeat. This is **best-effort**, **not**
strict/atomic idempotency (see DATA_MODEL.md idempotency note and SECURITY.md §3). Key facts:
- **Same `requestId`** → normally returns the original result (no duplicate created).
- **Different `requestId`s** → always a new intent, so profiles with identical names are allowed.
- The read→create→write-key sequence is **not atomic** (residual concurrency race).
- The **UI in-flight guard** reduces the practical risk for this single-owner family MVP.
- A future **generic atomic** solution should claim the key **before** entity creation (unique
  composite index); scheduled for **M3**, when meal creation also needs idempotency.

**No name-based dedup.** Earlier M1 drafts risked treating `name` (or `name + relation`) as a
uniqueness key. That is removed: names are free-form and non-unique per owner (two children
named "宝宝" are valid). Duplicate *submissions* are handled at two layers instead:

1. **Client UI guard** — a `submitting` in-flight flag on the profiles/profile-edit pages
   prevents a second tap while a create call is outstanding.
2. **Request-level idempotency** — the client generates a stable `requestId`
   (`req_<time36>_<random>`) once per edit session and sends it with `create`. The server
   looks up `(ownerOpenid, operation='create', requestId)` in `idempotency_keys`; a hit
   returns the originally created profile, a miss creates the profile and records the key.
   A *different* `requestId` is always a new intent, even with identical `name`/`relation`.
   `requestId` is scoped by the trusted `ownerOpenid`, so different users may reuse the same
   string safely.

> **Residual race (documented, mitigated).** The read→create→write-key sequence is not
> atomic; two simultaneous same-`requestId` calls could both miss the lookup. Mitigated by the
> UI guard and single-user tap concurrency. The **generic race-free** design deferred to M3:
> a **unique** composite index on `(ownerOpenid, operation, requestId)` so the key insert
> itself is the gate — a duplicate-key error means "already processed, return `resultId`."

**Default = single source of truth.** `users.defaultFamilyProfileId` is the only persisted
default. `family_profiles` has **no** `isDefault` field. `setDefault` writes only the user
record; the client-facing `isDefault` is computed in the DTO. A stale/missing default id
yields no profile marked default (safe fallback, no repair needed).

## 6. Shared-runtime packaging (M1)

M0 used compile-time-only `import type` from `shared/`. M1 needs the shared **runtime**
(validators, user/profile services, repository contract) to execute inside cloud functions,
with no duplicated, hand-maintained validators and no symlinks.

Approach (`scripts/build-shared.mjs`, wired into `npm run build:shared`):
1. Compiles `shared/` (TypeScript) to CommonJS in `shared/dist/`.
2. Copies the compiled runtime into each cloud function's `lib/shared/`
   (`cloudfunctions/<fn>/lib/shared/`), preserving the directory layout
   (`lib/shared/services/profile-service.js`, etc.).
3. Writes a `{ "type": "commonjs" }` marker into each `lib/shared/` so Node resolves the
   copied `.js` as CommonJS.

Properties:
- **Single source of truth:** `shared/*.ts` is the only implementation; cloud functions
  `require('./lib/shared/services/...')`.
- **No symlinks** (Windows-friendly) — plain recursive copy.
- **Generated, not committed:** `shared/dist/` and `cloudfunctions/<fn>/lib/shared/` are
  git-ignored (see `.gitignore`). Only `shared/*.ts` is tracked.
- **Works on Windows**, no native tooling.
- **Included in `npm run validate`:** the build runs before the test, and the test asserts
  the shared runtime is present in the affected packages (`login`, `profileApi`) and that
  the cloud functions `require` it.
- **Before deploying** a cloud function from WeChat DevTools, run `npm run build:shared` so
  `lib/shared/` is regenerated into the function folder.

The client currently uses `import type` for shared types and re-implements a 10-line
`resolveActiveProfile` helper (mirrored/tested in `shared/services/session.ts`). If a future
milestone needs shared runtime on the client too, the same copy step can target
`miniprogram/lib/shared/` — the mechanism is already proven.

## 7. Photo-storage workflow (M6, planned)

1. Client uploads the meal photo to CloudBase Storage → receives a `fileID`.
2. Client stores `fileID` on the `meals` record (`photoFileId`) and/or passes it to
   `aiAnalyze`.
3. `aiAnalyze` reads the photo by `fileID` (server-side) when a real provider is integrated.
4. Suggestions are returned for **confirmation/correction**; only confirmed items contribute
   to nutrition, recomputed by the shared layer.

Photos are private to the owner; access is scoped via CloudBase security rules.

## 8. Future AI adapter design

- **Contract:** `AiProvider { name; analyze(req): AiAnalysisResult }` and the request/result
  shapes in `shared/types.ts`.
- **Selection:** server-side, via `AI_PROVIDER` env var (`mock` → real later).
- **Isolation:** the AI layer is strictly separate from the nutrition layer. AI output maps
  to *suggested* foods/grams; the user confirms; nutrition is recomputed from confirmed input.
- **Graceful degradation:** any AI failure/absence returns an empty/failed result and the
  client falls back to manual logging.

## 9. Security boundaries (M1 emphasis)

- **Identity is server-side only.** Every cloud function derives the caller from the trusted
  WeChat context (`cloud.getWXContext().OPENID`). The client **never sends, receives, or
  stores `openid`**. It receives only a non-sensitive internal user document id and the
  default profile id. `openid` remains a server-side identity/ownership value.
- **Client-safe responses.** `login` returns `{ id, defaultFamilyProfileId }`; `profileApi`
  returns profiles without `ownerOpenid`. Ownership is never leaked to the client.
- **Authorization is enforced server-side.** Reads/writes are scoped by the server-derived
  openid. Cross-user access (list/update/setDefault) is rejected with `forbidden`/`not_found`
  and never leaks another user's data.
- **No client writes to user-owned collections.** `users` and `family_profiles` are written
  only through the trusted cloud functions. The client has no database write path.
- **Validation is shared + server-trusted.** Inputs are normalized/validated with the shared
  logic on the server; unknown and ownership fields submitted by the client are dropped.
- **Secrets:** no API keys, AI secrets, CloudBase env IDs, or WeChat appid in client code or
  the repo. Client config uses blank placeholders + git-ignored local overrides. AI secrets
  live only in CloudBase function environment variables.
- **Trust rule (meals, later):** nutrition totals are recomputed on the server; client-sent
  totals are treated as untrusted and overwritten.

See `docs/SECURITY.md` for collections, indexes, recommended CloudBase security rules, and
dev/prod guidance.

## 10. Development and production environments

- Two CloudBase environments: `dev` and `prod`, each with its own DB, storage, functions and
  env vars.
- Client selects the target in `miniprogram/config/env.ts` (`ACTIVE_ENV`) with the actual
  env ID injected locally (`env.local.ts`) or by CI — never committed.
- Recommended flow: develop against `dev`; promote via Git; deploy functions (run
  `npm run build:shared` first) and switch `ACTIVE_ENV=prod` for production builds.

## 11. M1 product decisions (recorded)

- **Single-owner model.** One WeChat account owns and manages multiple family-member
  profiles. No multi-WeChat-user household sharing, invitations, roles, or cross-account
  access in v0.1.
- **Family-profile deletion is deferred.** M1 implements create / list / update / select /
  set-default only. Hard deletion is out of scope; archive/soft-delete will be designed later
  (documented, not implemented).
- **Local natural-day rule.** Elsewhere in the app, a meal belongs to the device's local
  calendar day `YYYY-MM-DD`, `00:00–23:59`. This convention is recorded now; meal functionality
  arrives in M3.
- **No nutrition goals / medical attributes in M1.** Profiles carry only `name` and
  `relation` for now.

## 12. M1.1 hardening decisions (recorded)

- **Names are not unique.** Name-based profile deduplication is removed. The same owner may
  create multiple profiles with identical `name` (or `name + relation`).
- **Idempotency is request-scoped, not content-scoped.** Duplicate submissions are prevented
  by a client `requestId` + the `idempotency_keys` collection, keyed by
  `(ownerOpenid, operation, requestId)`, plus a UI in-flight guard. Residual non-atomic race
  is documented; the race-free unique-index design is deferred to M3.
- **One source of truth for the default profile.** `users.defaultFamilyProfileId` is the only
  persisted default state; `family_profiles` stores no `isDefault`; the client `isDefault`
  flag is computed in the DTO; stale/missing default → safe fallback.
