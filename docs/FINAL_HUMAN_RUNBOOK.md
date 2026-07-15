# Final Human Runbook - Family Meal Log MVP

This runbook consolidates every remaining human-only step into one ordered session.

Nothing in this file has been executed by the coding agent unless explicitly stated elsewhere.

## 1. Prepare the local environment

1. Confirm you are on `feature/mvp-completion`.
2. Run:
   - `npm ci`
   - `npm run validate`
3. Ensure the git working tree is clean before any deployment or merge step.
4. Open the repository in WeChat DevTools.

## 2. Create CloudBase collections

Create these collections if they do not already exist:

1. `users`
2. `family_profiles`
3. `idempotency_keys`
4. `meals`
5. `foods`
6. `recipes`
7. `ai_analyses`

## 3. Create CloudBase indexes

Create these indexes exactly:

### `users`

1. `openid` unique

### `family_profiles`

1. `(ownerOpenid, createdAt)`

### `idempotency_keys`

1. `(ownerOpenid, operation, requestId)`

### `meals`

1. `(ownerOpenid, familyProfileId, date)`
2. `(ownerOpenid, requestId)` **unique**

The second index is required for the strongest practical atomic meal-create replay used by the
repository. Without it, duplicate rapid submits may still race.

### `foods`

1. `(ownerOpenid, updatedAt)`

### `recipes`

1. `(ownerOpenid, updatedAt)`

### `ai_analyses`

1. `(ownerOpenid, createdAt)`

## 4. Apply database security rules

For each of these collections, keep direct Mini Program reads and writes disabled unless you are
performing a tightly scoped temporary debug session:

1. `users`
2. `family_profiles`
3. `idempotency_keys`
4. `meals`
5. `foods`
6. `recipes`
7. `ai_analyses`

Recommended rule:

```json
{
  "read": false,
  "write": false
}
```

## 5. Configure Storage for meal photos

1. Confirm CloudBase Storage is enabled for the target environment.
2. Verify the bucket is not publicly open by default.
3. Confirm uploads through the Mini Program can create files under the `meal-photos/` prefix.
4. Verify that a saved `photoFileId` can later be resolved by the Mini Program without exposing
   public secrets or public object URLs in the repo.

## 6. Configure local and cloud environment values

### Local only

1. Set the local CloudBase env id in the git-ignored Mini Program override file.
2. Confirm `project.private.config.json` uses the correct local appid and is not staged.

### Cloud-function environment variables for AI

Supported names:

1. `AI_PROVIDER`
2. `AI_API_URL`
3. `AI_API_KEY`
4. `AI_MODEL`
5. `AI_TIMEOUT_MS`

Recommended modes:

1. `AI_PROVIDER=disabled`
2. `AI_PROVIDER=mock`
3. `AI_PROVIDER=<your real provider label>`

For mock mode, no additional AI secrets are needed.

For real mode, set all of:

1. `AI_API_URL`
2. `AI_API_KEY`
3. `AI_MODEL`

Optional:

1. `AI_TIMEOUT_MS`

## 7. Rebuild shared runtime before deployment

Run:

1. `npm run build:shared`

This must happen before uploading cloud functions or packaging the Mini Program.

## 8. Deploy cloud functions in order

Deploy these cloud functions from WeChat DevTools in this order:

1. `login`
2. `profileApi`
3. `mealApi`
4. `aiAnalyze`

After each upload:

1. verify the upload succeeded,
2. confirm the bundled shared runtime is included,
3. check the DevTools console for startup errors.

## 9. Compile the Mini Program in WeChat DevTools

1. Rebuild/compile the Mini Program.
2. Confirm there are no TypeScript or WXML/WXSS errors.
3. Open:
   - home
   - add-meal
   - library
   - profiles
4. Confirm navigation works cleanly between those pages.

## 10. DevTools network and console verification

Verify in DevTools:

1. `login` succeeds and returns client-safe identity metadata only.
2. `profileApi` calls return no `openid` or `ownerOpenid`.
3. `mealApi` meal responses return no `ownerOpenid` or `requestId`.
4. `aiAnalyze` returns advisory suggestions or graceful failures only.
5. No cloud function logs expose secrets, env ids, or provider keys.

## 11. Single-account functional verification

Run the full checklist in [MANUAL_TEST_CHECKLIST.md](./MANUAL_TEST_CHECKLIST.md), including:

1. profile create/edit/default flows,
2. food search and preview,
3. manual meal create,
4. daily history refresh,
5. meal edit and delete,
6. saved-food flows,
7. recipe create/edit/delete,
8. recipe logging into meals.

## 12. Photo upload verification

1. Upload a meal photo successfully.
2. Save the meal and reopen it.
3. Confirm the meal retains the photo reference.
4. Remove the photo during meal edit and save again.
5. Simulate a failed upload.
6. Confirm manual meal save still works when the upload fails.

## 13. AI-disabled verification

1. Set `AI_PROVIDER=disabled`.
2. Upload or choose a meal photo.
3. Trigger AI analysis.
4. Confirm:
   - no suggestions are added,
   - a graceful disabled/failure message appears,
   - manual meal entry still works.

## 14. Mock AI verification

1. Set `AI_PROVIDER=mock`.
2. Trigger AI analysis on a meal photo.
3. Confirm deterministic suggestions appear.
4. Edit one suggestion before confirming it into the draft.
5. Save the meal.
6. Confirm:
   - only confirmed suggestions affect the meal,
   - meal source is AI-assisted,
   - totals still match shared nutrition recomputation.

## 15. Real AI verification

1. Set `AI_PROVIDER` to the real provider label used in your environment.
2. Configure `AI_API_URL`, `AI_API_KEY`, and `AI_MODEL`.
3. Optionally configure `AI_TIMEOUT_MS`.
4. Trigger AI analysis with a representative test photo.
5. Confirm:
   - analysis returns suggestions or a graceful failure,
   - the Mini Program never displays or logs the secret,
   - manual entry remains available when the provider fails.
6. Intentionally break one of:
   - URL
   - key
   - model
7. Confirm malformed/failed responses degrade safely.

## 16. Second-account ownership verification

Using a different WeChat account against the same dev environment:

1. confirm the second account cannot see the first account’s profiles,
2. confirm it cannot read or edit the first account’s meals,
3. confirm it cannot access the first account’s saved foods,
4. confirm it cannot access the first account’s recipes,
5. confirm it cannot access the first account’s AI analyses.

## 17. Real phone preview verification

1. Publish a phone preview or experience build from WeChat DevTools.
2. Repeat the critical create/edit/delete, saved-food, recipe, photo, AI-disabled, mock AI, and
   real AI scenarios on a physical device.
3. Watch for:
   - copy rendering,
   - permission prompts,
   - photo upload behavior,
   - navigation stability,
   - tap handling and performance.

## 18. Final repository and PR actions

1. Push the final `feature/mvp-completion` branch if additional local commits were created.
2. Create or update the Draft PR against `master` titled:
   - `feat: complete Family Meal Log MVP`
3. If GitHub integration permissions still block PR creation, use:
   - `https://github.com/sheng6272-bit/family-meal-log/pull/new/feature/mvp-completion`
4. After human review and approval, merge the PR into `master`.

## 19. Branch cleanup

After merge:

1. confirm `master` contains the merged work,
2. delete `feature/mvp-completion` locally if desired,
3. delete the remote branch if desired,
4. keep this runbook and the manual checklist as the audit trail for what still required human execution.
