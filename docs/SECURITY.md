# Security and Deployment - Family Meal Log MVP

This document records the current security posture through the M3 checkpoint.

## 1. Trust model

- **Identity is server-side only.** Every cloud function derives the caller from
  `cloud.getWXContext().OPENID`.
- **Cloud functions are the only trusted write path.** The client does not write directly to
  `users`, `family_profiles`, or `meals`.
- **Authorization is server-enforced.** Owner scoping happens on the trusted boundary.
- **Meal nutrition is server-trusted.** Client-supplied `totals`, `ownerOpenid`, and tampered
  seed-food nutrition values are ignored or overwritten.
- **No secrets belong in the repo or client bundle.**

## 2. Required collections

| Collection | Purpose | Written by |
|------------|---------|------------|
| `users` | one doc per WeChat user; stores `defaultFamilyProfileId` | `login`, `profileApi` |
| `family_profiles` | owner-scoped family members | `profileApi` |
| `idempotency_keys` | request replay for profile create | `profileApi` |
| `meals` | persisted manual meal records with embedded snapshots | `mealApi` |

## 3. Required indexes

Create these in CloudBase:

- `users.openid` unique
- `family_profiles(ownerOpenid, createdAt)`
- `idempotency_keys(ownerOpenid, operation, requestId)`
- `meals(ownerOpenid, familyProfileId, date)`

Recommended future hardening:

- `meals(ownerOpenid, requestId)` unique for atomic meal replay

Current honesty note:

- profile replay is best-effort,
- meal replay is also best-effort,
- neither path is currently an atomic uniqueness guarantee.

## 4. Recommended security rules

Cloud functions run with admin privileges, so direct client access to user-owned collections
should stay blocked.

Recommended rule for `users`, `family_profiles`, `idempotency_keys`, and `meals`:

```json
{
  "read": false,
  "write": false
}
```

If temporary development-time read access is needed, keep writes disabled and scope reads to
the owner only.

## 5. Direct client writes are forbidden

The Mini Program should not call `wx.cloud.database().collection(...).add/update/remove` for
user-owned collections. Client access should stay routed through:

- `login`
- `profileApi`
- `mealApi`

## 6. Response safety

Client-facing responses must not expose:

- `openid`
- `ownerOpenid`
- `requestId`
- secrets or env ids

Current M3 rule:

- `mealApi` returns a client-safe meal DTO without `ownerOpenid` or `requestId`.

## 7. Secrets and environment safety

- Keep real CloudBase env IDs out of tracked files.
- Keep `project.private.config.json` untracked.
- Keep `.env` and local override files untracked.
- Store any future AI credentials only in cloud-function environment variables.

## 8. Deploy flow

1. Run `npm run build:shared`.
2. Upload changed cloud functions from WeChat DevTools.
3. Build or preview the Mini Program against the intended environment.

Never claim deployment succeeded unless it was actually performed.
