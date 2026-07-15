# Manual Acceptance Test Checklist - M1 to M3

These steps cover behavior that cannot be proven headlessly. Automated logic and structural
checks already run under `npm run validate`; this checklist is for WeChat DevTools and a real
phone.

Prereqs:

- a CloudBase `dev` environment exists,
- `miniprogram/config/env.local.ts` points at that `dev` env,
- `npm run build:shared` has been run,
- cloud functions `login`, `profileApi`, and `mealApi` are uploaded.

## A. WeChat DevTools - profiles (M1)

1. Clear local storage and run the app.
   Expected: app boots cleanly and either shows onboarding or an active profile.
2. Create the first profile.
   Expected: it becomes both current and default.
3. Create a second profile.
   Expected: both profiles are listed and ownership remains scoped to the current account.
4. Switch between profiles.
   Expected: the current profile changes immediately.
5. Set the second profile as default.
   Expected: the default badge moves and later launches resolve that profile.
6. Reopen the Mini Program.
   Expected: active/default resolution follows the documented priority order.
7. Edit a profile name or relation.
   Expected: the original profile updates in place; no duplicate is created.
8. Try invalid profile input.
   Expected: empty name is blocked and relation stays limited to valid options.

## B. WeChat DevTools - food search and preview (M2)

1. Open add-meal.
   Expected: search UI, meal type selector, and current profile card are visible.
2. Leave search empty.
   Expected: bundled seed foods are listed.
3. Search by a Chinese food name.
   Expected: partial matching works.
4. Search by category.
   Expected: category filtering works.
5. Select a seed food.
   Expected: food-specific units appear before generic units.
6. Change unit and quantity.
   Expected: grams and macros update live.
7. Open the ad-hoc food form.
   Expected: fields for name, brand, category, and per-100g macros appear.
8. Create a valid ad-hoc food.
   Expected: it becomes immediately selectable for preview.
9. Try invalid ad-hoc input.
   Expected: empty name, negative macros, or non-numeric input show clear errors.
10. Blank `cloudEnvId` temporarily and repeat search/preview.
   Expected: bundled search and preview still work offline.

## C. WeChat DevTools - manual meal logging (M3)

1. Restore a valid env and ensure an active profile is selected.
2. Open add-meal.
   Expected: save button is present but stays disabled until at least one draft item exists.
3. Add a first draft item.
   Expected: it appears in the draft list and the total card appears.
4. Add a second draft item.
   Expected: totals equal the sum of both item previews.
5. Edit one draft item.
   Expected: the row updates in place and totals change accordingly.
6. Remove one draft item.
   Expected: the row disappears and totals shrink accordingly.
7. Save the meal.
   Expected: success toast, draft clears only after success, and a recent-saved summary appears.
8. Confirm reload behavior.
   Expected: the recent-saved summary reflects the persisted meal returned by `mealApi.get`.
9. Simulate missing active profile.
   Expected: save stays disabled and the page asks the user to choose a family member first.
10. Simulate offline save.
    Expected: item preview still works, but save is blocked with a clear offline message and no
    fake success.
11. Restore connectivity and save again.
    Expected: the existing draft can be retried successfully without rebuilding it from scratch.

## D. Real phone

Repeat the key profile, search/preview, and meal-save scenarios on a real device using a preview
or experience build against the `dev` environment.

Pay special attention to:

- Chinese copy rendering,
- tap handling,
- active-profile persistence across app restarts,
- successful meal save and recent-saved summary display.

## Notes

- Ownership isolation is primarily covered by automated tests; a second test account can be used
  for a manual sanity check if available.
- Ad-hoc foods remain session-level inputs. In M3 they persist only as snapshots inside saved
  meals, not yet as reusable saved-food records.
- Any step not run on a real device must remain marked as pending manual verification.
