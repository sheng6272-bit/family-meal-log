# Security & Deployment — Family Meal Log MVP

This document records the security boundaries, required CloudBase collections/indexes,
recommended security rules, and dev/prod setup for M1. It is the complement to
`docs/ARCHITECTURE.md` and `docs/DATA_MODEL.md`.

## 1. Trust model (summary)

- **Identity is server-side.** Every cloud function derives the caller from
  `cloud.getWXContext().OPENID`. The client never sends, receives, or stores `openid`.
- **Cloud functions are the only trusted write path.** The client has **no direct database
  write access**. `users` and `family_profiles` are written only inside `login` /
  `profileApi`.
- **Authorization is enforced server-side**, scoped by the server-derived openid. Cross-user
  access returns `forbidden` / `not_found` and never leaks another user's data.
- **No secrets in the repo or client bundle.** CloudBase env IDs, appid, and AI keys live
  only in CloudBase function environment variables or git-ignored local files.

## 2. Required collections

| Collection | Purpose | Written by |
|-----------|---------|------------|
| `users` | one per WeChat user; holds `defaultFamilyProfileId` (**sole default source of truth**) | `login`, `profileApi` (setDefault) |
| `family_profiles` | the account's family members (**no `isDefault` stored**) | `profileApi` |
| `idempotency_keys` | request-level idempotency records for create ops (M1.1) | `profileApi` |

(Meals, foods, etc. are added in later milestones; see `docs/DATA_MODEL.md`.)

## 3. Required indexes

Create these in the CloudBase console (DB → collection → index management):

- `users`: `openid` — **unique** (one document per WeChat user; makes `login` upsert safe and
  fast).
- `family_profiles`: `ownerOpenid` (asc) + `createdAt` (asc) — owner-scoped list in a
  deterministic order.
- `idempotency_keys`: `ownerOpenid` + `operation` + `requestId` — composite (**currently
  non-unique**). **Recommended unique** at M3 so the key insert becomes the atomic idempotency
  gate (see the note below).

> **Race-condition note (documented, not silently assumed):** CloudBase document DB has no
> single-call transactional `findOrCreate` with a hard unique constraint. `login` mitigates
> with query-then-insert keyed on `openid` (treated as the ownership key) and is idempotent
> for the normal single-caller case. If/when CloudBase supports a unique-index-enforced
> upsert, switch to it. Repeated login calls already return the same record today under
> normal concurrency.

> **Create idempotency (M1.1):** `profileApi.create` no longer deduplicates by `name`.
> Duplicate submissions are collapsed by a client `requestId` recorded in `idempotency_keys`,
> keyed by `(ownerOpenid, operation, requestId)`, plus a client in-flight guard. This is
> **best-effort request idempotency (尽力式请求幂等)** — *client in-flight protection plus
> server-side request replay handling* — **not** a strict/atomic guarantee. The
> read→create→write-key path is **not atomic**; two truly-concurrent same-`requestId` calls
> could both create a profile (residual concurrency race). This residual race is accepted for
> M1 (single-user tap concurrency + UI guard). **M3 hardening:** promote the composite index to
> **unique** and treat a duplicate-key insert as "already processed → return stored
> `resultId`."

> **Default-profile source of truth (M1.1):** the default profile is represented **only** by
> `users.defaultFamilyProfileId`. `family_profiles` carries no `isDefault` field; `setDefault`
> writes only the user record; the client `isDefault` flag is computed in the DTO. A stale
> default id needs no repair — it simply results in no profile being marked default.

## 4. Recommended CloudBase security rules

Cloud functions (`wx-server-sdk`) bypass security rules and run with admin privileges, so the
rules below **block all direct client access** and force every read/write through the trusted
functions.

For `users`, `family_profiles`, `idempotency_keys` (and later `meals`, `foods`, `recipes`,
`ai_analyses`):

```json
{
  "read": false,
  "write": false
}
```

If you prefer to allow read-only client access for a specific collection during development,
scope it to the owner, e.g. for `family_profiles`:

```json
{
  "read": "doc.ownerOpenid == auth.openid",
  "write": false
}
```

> Keep `write: false` everywhere — writes must go through cloud functions. Do not grant the
> client write permission to `users` or `family_profiles`.

## 5. Direct client writes are denied

- The Mini Program uses `services/cloud.ts` only to call cloud functions; it never calls
  `wx.cloud.database().collection(...).add/update/remove` for user-owned collections.
- CI / pre-deploy checks should fail if any client code references direct DB writes to
  `users` / `family_profiles` (manual review + the `npm run validate` secret-hygiene checks
  cover the committed-source side).

## 6. Development vs production

- Two CloudBase environments: `dev` and `prod`, each with its own database, storage, cloud
  functions, and environment variables.
- Client selects the target in `miniprogram/config/env.ts` (`ACTIVE_ENV`); the real env ID is
  injected locally via `env.local.ts` (git-ignored) or by CI — **never committed**.
- AI secrets (future) live only in CloudBase function environment variables
  (`AI_PROVIDER`, `AI_API_KEY`); the client never sees them.
- **Deploy flow:** run `npm run build:shared` (packages the shared runtime into each cloud
  function's `lib/shared/`), then upload the functions from WeChat DevTools. Deploy the
  Mini Program from the same `miniprogramRoot`.

## 7. Secret hygiene checklist (committed source)

- [ ] No real CloudBase env ID in `miniprogram/config/env.ts` (placeholders only).
- [ ] No `.env`, `env.local.ts`, or `project.private.config.json` committed (git-ignored).
- [ ] No `openid` returned to or stored by the client.
- [ ] No AI keys in client code or repo.
- [ ] Generated artifacts (`shared/dist/`, `cloudfunctions/*/lib/shared/`) are git-ignored.
