# Manual Acceptance Test Checklist - M1 to M8

This checklist is for WeChat DevTools and real-device verification. Automated logic and
structural checks already run under `npm run validate`.

Before starting, follow [FINAL_HUMAN_RUNBOOK.md](./FINAL_HUMAN_RUNBOOK.md) through collection,
index, security-rule, storage, and cloud-function deployment setup.

## A. Profiles and ownership

1. Clear local storage and reopen the app.
   Expected: onboarding or a resolved active profile appears cleanly.
2. Create the first profile.
   Expected: it becomes current and default.
3. Create a second profile.
   Expected: both profiles appear under the same owner.
4. Switch the active profile.
   Expected: home and add-meal reflect the selected profile immediately.
5. Change the default profile.
   Expected: the default badge moves and later launches resolve it.
6. Edit a profile.
   Expected: the original profile updates in place.
7. Try invalid profile input.
   Expected: empty name or invalid relation is blocked with clear copy.

## B. Food search and preview

1. Open add-meal.
   Expected: date, meal type, search, and draft areas are visible.
2. Search bundled food by Chinese name and by category.
   Expected: matching results appear.
3. Select a food and change units and quantity.
   Expected: grams and macros update live.
4. Add a valid custom food.
   Expected: it becomes immediately selectable.
5. Try invalid custom-food input.
   Expected: clear validation feedback appears.

## C. Manual meal create, history, edit, delete

1. Add two draft items and save a meal.
   Expected: success toast and trusted saved summary appear.
2. Return to home for the same day.
   Expected: daily totals include the new meal.
3. Change the date.
   Expected: the list and totals switch to the selected day.
4. Open the saved meal for edit.
   Expected: the meal reloads with its saved items.
5. Change one item and save again.
   Expected: totals update both in the editor and on home.
6. Delete the meal.
   Expected: the meal disappears from history and totals refresh.

## D. Saved foods and recipes

1. Save a system food from add-meal.
   Expected: it appears in the library and future search results.
2. Remove the saved food.
   Expected: it disappears from the library without affecting old meals.
3. Create a recipe from two ingredients.
   Expected: the library shows servings, grams per serving, and per-serving nutrition.
4. Search the recipe from add-meal.
   Expected: it appears as a selectable recipe food with a `1份` default unit.
5. Log a meal using the recipe.
   Expected: the saved meal totals match the recipe servings used.
6. Edit and then delete the recipe.
   Expected: updates apply, then the recipe disappears from search and the library.

## E. Photo upload

1. Choose and upload a meal photo.
   Expected: preview appears and save still works.
2. Save the meal with the photo attached.
   Expected: re-opened meal still shows the stored photo reference.
3. Remove the photo during edit and save again.
   Expected: the meal persists without a photo.
4. Simulate a failed upload.
   Expected: a clear photo error appears but manual save remains available.

## F. AI-disabled, mock AI, and real AI

### AI disabled

1. Set `AI_PROVIDER=disabled` in the `aiAnalyze` cloud-function environment.
2. Trigger AI analysis from add-meal.
   Expected: no suggestions are returned and the user can continue manually.

### Mock AI

1. Set `AI_PROVIDER=mock`.
2. Upload a meal photo and trigger AI analysis.
   Expected: deterministic suggestions appear.
3. Modify one suggestion before confirming it into the draft.
   Expected: only the confirmed edited version enters the meal draft.
4. Save the meal.
   Expected: meal source is AI-assisted, but totals still match the confirmed items only.

### Real AI

1. Set `AI_PROVIDER=openai-compatible` and configure the real provider env vars.
2. Trigger AI analysis with a valid test photo.
   Expected: the request succeeds or fails gracefully without blocking manual entry, and the
   real provider receives the actual image via a server-resolved temporary CloudBase URL.
3. Temporarily break the model/url/key configuration.
   Expected: analysis degrades cleanly and manual logging still works.

## G. Second-account ownership check

1. Use a second WeChat account against the same dev environment.
2. Confirm the second account cannot see or edit the first account’s profiles, meals, saved foods, recipes, or AI analyses.

## H. Real phone

Repeat the critical create/edit/delete, saved-food, recipe, photo-upload, AI-disabled, mock AI,
and real AI scenarios on a real phone preview build.

Pay attention to:

- Chinese copy rendering,
- photo permissions and upload stability,
- navigation between home, add-meal, and library,
- second-account isolation,
- network and console behavior in DevTools.
