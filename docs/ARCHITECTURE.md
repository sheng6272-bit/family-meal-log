# Architecture — Family Meal Log MVP

## 1. High-level overview

```
+------------------------------------------------------+
|              WeChat Mini Program (client)            |
|  Pages (home, add-meal, ...)                         |
|  Services: cloud wrapper, provider-neutral AI adapter|
|  Config: env (no secrets)                            |
|                     |                                |
|          import type / shared logic                  |
+---------------------|--------------------------------+
                      |  (wx.cloud.callFunction / DB / storage)
                      v
+------------------------------------------------------+
|                 Tencent CloudBase                    |
|  Cloud Functions: login, mealApi, aiAnalyze          |
|  Database (document collections)                     |
|  Storage (meal photos)                               |
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
- **Services** (`miniprogram/services/*`):
  - `cloud.ts` — the only place that touches `wx.cloud`; initializes CloudBase and exposes
    `callFunction`. Degrades to offline mode when no env ID is configured.
  - `ai/ai-adapter.ts` — provider-neutral entry `analyzeMealPhoto()`; routes to the
    `aiAnalyze` cloud function when available, else falls back to the local mock.
  - `ai/mock-provider.ts` — deterministic offline suggestions.
- **Config** (`miniprogram/config/env.ts`): environment selection; **no secrets**, blank
  CloudBase IDs by default; local override via `env.local.ts` (git-ignored) or CI injection.
- **Shared imports:** pages/services import **types** from `shared/*` using `import type`
  (erased at compile time, so no cross-root runtime bundling issue). Runtime nutrition logic
  is executed server-side and, where needed on the client, will be bundled via a build step
  in a later milestone (see §9 note).

## 3. CloudBase architecture

- **Database:** document collections (see §4).
- **Storage:** meal photos, addressed by CloudBase `fileID`.
- **Cloud functions:** the trusted boundary. They derive identity from the WeChat context,
  re-validate inputs with the shared validators, and recompute nutrition with the shared
  nutrition layer. Clients are never trusted for identity or final totals.
- **Environments:** separate `dev` and `prod` CloudBase environments; the client selects one
  via `env.ts`. Secrets live only in function environment variables per environment.

## 4. Database collections

| Collection | Key fields | Notes / access |
|-----------|------------|----------------|
| `users` | `openid`, `defaultFamilyProfileId` | one per WeChat user; owner-only |
| `family_profiles` | `ownerOpenid`, `name`, `relation` | owner-only |
| `foods` | `name`, `per100g`, `source`, `ownerOpenid?`, `isSaved` | system foods readable; user foods owner-only |
| `portion_units` | `label`, `gramsPerUnit`, `foodId?` | generic + food-specific |
| `meals` | `ownerOpenid`, `familyProfileId`, `date`, `mealType`, `items[]`, `totals` | owner-only; indexed by (`ownerOpenid`,`familyProfileId`,`date`) |
| `recipes` | `ownerOpenid`, `name`, `servings`, `ingredients[]`, `perServing` | owner-only |
| `ai_analyses` | `ownerOpenid`, `photoFileId`, `provider`, `status`, `suggestions[]` | owner-only; advisory records |

Schemas are defined in `shared/types.ts`; see `docs/DATA_MODEL.md`.

## 5. Cloud-function responsibilities

| Function | Responsibility (target) | v0.1 status |
|----------|-------------------------|-------------|
| `login` | Return the caller's `openid`/`unionid` from the WeChat context; upsert `users`. | openid resolution implemented; upsert later |
| `mealApi` | Create/update/delete/list meals; **re-validate** with shared validators; **recompute** `totals` via shared nutrition; enforce per-user access. | placeholder (routes only) |
| `aiAnalyze` | Provider-neutral photo analysis; select provider by `AI_PROVIDER` env var; return advisory suggestions; never persist final nutrition. | mock provider implemented |

## 6. Photo-storage workflow

1. Client uploads the meal photo to CloudBase Storage → receives a `fileID`.
2. Client stores `fileID` on the `meals` record (`photoFileId`) and/or passes it to
   `aiAnalyze`.
3. `aiAnalyze` reads the photo by `fileID` (server-side) when a real provider is integrated;
   the mock provider ignores pixels and returns deterministic suggestions.
4. Suggestions are returned to the client for **confirmation/correction**; only confirmed
   items contribute to nutrition, which is recomputed by the shared layer.

Photos are private to the owner; access is scoped via CloudBase security rules.

## 7. Future AI adapter design

- **Contract:** `AiProvider { name; analyze(req): AiAnalysisResult }` and the request/result
  shapes in `shared/types.ts` (`AiAnalysisRequest`, `AiAnalysisResult`, `AiFoodSuggestion`).
- **Selection:** server-side, via `AI_PROVIDER` env var (`mock` → real later). The client
  contract never changes when the provider changes.
- **Isolation:** the AI layer is strictly separate from the nutrition layer. AI output maps
  to *suggested* foods/grams; the user confirms; nutrition is recomputed from confirmed
  input. AI is therefore never the source of nutritional truth.
- **Graceful degradation:** any AI failure/absence returns an empty/failed result and the
  client falls back to manual logging.

## 8. Security boundaries

- **Identity:** always derived server-side from the WeChat context; clients never send their
  own `openid` as trusted input.
- **Authorization:** every record carries `ownerOpenid`; functions and DB security rules
  enforce owner-only access.
- **Secrets:** no API keys, AI secrets, CloudBase env IDs, or WeChat appid in client code or
  the repo. Client config uses blank placeholders + git-ignored local overrides. AI secrets
  live only in CloudBase function environment variables.
- **Validation:** inputs re-validated server-side with the shared validators before writes.
- **Trust rule:** nutrition totals are recomputed on the server; client-sent totals are
  treated as untrusted and overwritten.

## 9. Development and production environments

- Two CloudBase environments: `dev` and `prod`, each with its own DB, storage, functions and
  env vars.
- Client selects the target in `miniprogram/config/env.ts` (`ACTIVE_ENV`) with the actual
  env ID injected locally (`env.local.ts`) or by CI — never committed.
- Recommended flow: develop against `dev`; promote via Git; deploy functions and switch
  `ACTIVE_ENV=prod` for production builds.

> **Note (shared code on the server):** cloud functions are deployed as independent units.
> For v0.1 they embed thin logic; the plan is to package the compiled `shared/` (validation +
> nutrition) into each function at deploy time (copy or a small build step) so client and
> server share exactly one implementation. This is intentionally deferred to keep the
> foundation minimal.
