# Security and Deployment - Family Meal Log MVP

This document describes the current security posture for the completed MVP codebase.

## 1. Trust model

- `openid` is trusted only when derived from `cloud.getWXContext().OPENID`.
- Cloud functions are the only trusted write path.
- Shared logic is the only trusted source of validation and nutrition math.
- Client-provided totals, owner identity, and canonical food nutrition are untrusted.
- AI output is advisory only and never becomes final nutrition without explicit confirmation.

## 2. Required collections

| Collection | Purpose | Written by |
|------------|---------|------------|
| `users` | trusted user records | `login`, `profileApi` |
| `family_profiles` | owner-scoped family members | `profileApi` |
| `idempotency_keys` | profile-create request replay | `profileApi` |
| `meals` | owner-scoped meals | `mealApi` |
| `foods` | owner-scoped saved foods | `mealApi` |
| `recipes` | owner-scoped recipes | `mealApi` |
| `ai_analyses` | advisory AI analyses | `aiAnalyze` |

## 3. Required indexes

These must be created manually in CloudBase before relying on the full MVP:

- `users.openid` unique
- `family_profiles(ownerOpenid, createdAt)`
- `idempotency_keys(ownerOpenid, operation, requestId)`
- `meals(ownerOpenid, familyProfileId, date)`
- `meals(ownerOpenid, requestId)` unique
- `foods(ownerOpenid, updatedAt)`
- `recipes(ownerOpenid, updatedAt)`
- `ai_analyses(ownerOpenid, createdAt)`

### Atomic meal replay note

The repository code now uses the correct duplicate-key recovery pattern for meal create:

1. attempt insert,
2. if duplicate-key occurs, re-read by `(ownerOpenid, requestId)`,
3. return the original meal.

That is the strongest practical atomic replay path supported here, but it depends on the
human-created unique index `meals(ownerOpenid, requestId)`.

## 4. Direct database rules

For user-owned collections, recommended CloudBase database rules are:

```json
{
  "read": false,
  "write": false
}
```

That applies to:

- `users`
- `family_profiles`
- `idempotency_keys`
- `meals`
- `foods`
- `recipes`
- `ai_analyses`

The app is designed to work through cloud functions, not direct client database writes.

## 5. Storage guidance

- Meal photos are uploaded to CloudBase Storage and referenced by `photoFileId`.
- Storage should remain non-public by default.
- The client should not depend on public object URLs or embedded secrets.
- In `AI_PROVIDER=openai-compatible` mode, the server resolves `photoFileId` into a short-lived
  CloudBase temporary URL and passes that URL to the provider as `image_url` content.
- Permanent public photo URLs must not be persisted or returned to the client.

Exact manual storage verification steps are in [FINAL_HUMAN_RUNBOOK.md](./FINAL_HUMAN_RUNBOOK.md).

## 6. Response safety

Client-safe responses must not expose:

- `openid`
- `ownerOpenid`
- `requestId`
- CloudBase environment ids
- provider secrets

## 7. AI provider secrets

Allowed cloud-function environment variables:

- `AI_PROVIDER`
- `AI_API_URL`
- `AI_API_KEY`
- `AI_MODEL`
- `AI_TIMEOUT_MS`

Rules:

- never commit the real values,
- never surface them to the Mini Program,
- never log them in docs, commit messages, or validation fixtures.

## 8. Deployment guardrails

Before deployment:

1. run `npm run build:shared`,
2. run `npm run validate`,
3. upload only the intended cloud functions,
4. verify in WeChat DevTools against the target environment.

Never claim deployment, storage configuration, or manual verification succeeded unless a human
actually performed it.
