# User Flows - Family Meal Log MVP

Manual logging is the primary path. AI remains optional and does not block the core workflow.

## 1. First-time login (M1)

1. User opens the Mini Program.
2. App initializes cloud support.
3. If no env ID is configured, the app enters offline shell mode.
4. If cloud is ready, the client calls `login`.
5. `login` derives `openid` server-side and upserts the user record.
6. The client loads profiles through `profileApi.list`.
7. If no profile exists yet, the app shows first-profile onboarding.

Fallback: login failure leaves identity/profile features disabled with a clear message.

## 2. Profile selection and default profile (M1)

1. The app resolves the active profile in this order:
   - remembered local active profile id if still valid,
   - `users.defaultFamilyProfileId`,
   - first available profile,
   - onboarding if none exist.
2. From the home page, the user opens profile management.
3. The user can select a profile for the current session.
4. The user can set a profile as default through `profileApi.setDefault`.

Rules:

- Only the profile id is stored locally.
- `isDefault` is computed in the DTO; it is not persisted on profile docs.

## 3. Create or edit a family profile (M1)

Create:

1. User enters name and relation.
2. Client generates a stable `requestId` for the edit session.
3. Client blocks duplicate taps while the request is in flight.
4. `profileApi.create` validates input server-side and sets ownership from the trusted context.
5. A repeated submit with the same `requestId` replays the original result.

Edit:

1. User opens an existing profile.
2. User updates name and/or relation.
3. `profileApi.update` validates and persists only editable fields.

## 4. Food search and item preview foundation (M2)

1. User opens add-meal.
2. User searches the bundled seed catalog by name, brand, or category.
3. User selects a food or defines an ad-hoc food for this session.
4. The page shows portion units with food-specific units first, then `g` and `ml`.
5. User enters quantity.
6. The page computes grams and item nutrition through the shared runtime.

Fallback: this search/preview flow works offline because the seed catalog is bundled.

## 5. Manual meal logging (M3)

1. User opens add-meal from home.
2. The page shows the active family member, date picker, and meal type selector.
3. User adds one item at a time from the catalog or an ad-hoc food.
4. Each item is previewed through shared nutrition logic, then added into a local draft meal.
5. Draft totals update live from the sum of draft item nutrition.
6. User taps save.
7. Client sends `requestId`, `familyProfileId`, `date`, `mealType`, and draft items to
   `mealApi.create`.
8. The server:
   - derives owner identity from WeChat context,
   - verifies the profile belongs to that owner,
   - canonicalizes system foods,
   - normalizes ad-hoc foods,
   - resolves the selected portion label,
   - recomputes item grams/nutrition and meal totals.
9. Client immediately calls `mealApi.get` for the created meal.
10. Only after both calls succeed does the page clear the draft and show a recent-saved summary.

Fallback behavior:

- If cloud is offline, preview still works but save is blocked with a clear message.
- If no active profile is selected, save stays disabled.
- If save fails, the draft stays in place and keeps the same `requestId` for retry.

## 6. Deferred flows

- Daily history, edit, and delete arrive in M4.
- Saved foods and recipes arrive in M5.
- Photo upload arrives in M6.
- AI-assisted suggestion flow arrives in M7 and remains optional.
