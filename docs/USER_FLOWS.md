# User Flows - Family Meal Log MVP

Manual logging is the primary workflow. AI remains optional and advisory.

## 1. First-time launch and profile resolution

1. User opens the Mini Program.
2. App initializes cloud support.
3. If cloud is unavailable, the app stays in offline shell mode.
4. If cloud is ready, the client calls `login`.
5. `login` derives `OPENID` server-side and upserts the user record.
6. Client loads profiles from `profileApi.list`.
7. Active profile resolves in this order:
   - locally remembered `familyProfileId` if still valid,
   - `users.defaultFamilyProfileId`,
   - first available profile,
   - onboarding when none exist.

## 2. Create or edit family members

Create:

1. User enters name and relation.
2. Client sends a stable `requestId`.
3. `profileApi.create` normalizes input and sets ownership from trusted context.
4. Repeated submits with the same `requestId` replay the original profile.

Edit:

1. User opens a profile.
2. User changes editable fields.
3. `profileApi.update` validates the patch and rejects cross-owner access.

## 3. Search food and preview nutrition

1. User opens add-meal.
2. User searches bundled foods, saved foods, or recipe foods.
3. User can also create a session-only ad-hoc food.
4. User selects a portion unit and quantity.
5. Shared logic computes grams and preview nutrition locally.

This preview flow works even before a meal is saved.

## 4. Manual meal create

1. User chooses meal date and meal type.
2. User adds one or more confirmed draft items.
3. Optional: user uploads a meal photo.
4. Optional: user opens the library to reuse a saved food or recipe.
5. User taps save.
6. Client sends:
   - `requestId`
   - `familyProfileId`
   - `date`
   - `mealType`
   - confirmed items
   - optional `photoFileId`
   - optional `aiAnalysisId`
7. `mealApi.create`:
   - derives owner from trusted context,
   - validates ownership,
   - canonicalizes system foods,
   - resolves recipe servings or saved foods,
   - recomputes grams and nutrition,
   - stores snapshots and trusted totals.
8. Client reloads the saved meal through `mealApi.get`.

## 5. Daily history, edit, and delete

1. User opens home.
2. User changes active date or active family member.
3. Home calls `mealApi.list`.
4. Page shows the returned meals plus aggregated day totals.
5. User can edit a meal, which opens add-meal with `mealId`.
6. User can delete a meal, which refreshes the current day totals immediately.

## 6. Saved foods and recipes

Saved foods:

1. User selects a non-recipe food in add-meal.
2. User taps “加入收藏”.
3. `mealApi.saveFood` persists an owner-scoped saved food.
4. Saved foods appear in the library and future add-meal search results.

Recipes:

1. User opens the library.
2. User searches foods and adds ingredients with gram amounts.
3. User sets the recipe name and number of servings.
4. `mealApi.createRecipe` computes per-serving nutrition in the shared layer.
5. Recipe foods appear in add-meal search and expose a default `1份` unit.

## 7. Photo upload

1. User taps to choose a meal photo.
2. Mini Program uploads it to CloudBase Storage.
3. Client stores the returned `photoFileId` in local page state.
4. Save/update requests include `photoFileId` when present.

Failure rule:

- upload failure must not block manual meal save.

## 8. AI suggestion flow

1. User uploads a meal photo.
2. User taps AI analysis.
3. Client calls `aiAnalyze`.
4. Cloud function selects a provider based on `AI_PROVIDER`.
5. Shared AI logic stores an advisory `ai_analysis` record.
6. Client renders suggestions separately from confirmed meal items.
7. User can edit a suggested food name or grams before confirming it into the draft.
8. Only confirmed items are sent to `mealApi.create` or `mealApi.update`.

## 9. Provider modes

- `AI_PROVIDER=mock`
  - deterministic mock suggestions.

- `AI_PROVIDER=disabled`
  - no suggestions, explicit failure message, manual entry continues.

- any other configured provider name
  - real provider path through the OpenAI-compatible adapter.

## 10. Fallback behavior

- Offline: local preview still works, cloud save does not pretend to succeed.
- Missing active profile: save is blocked with a clear message.
- Photo upload failure: user can still save the meal manually.
- AI failure: user stays in manual flow with no nutrition corruption.
