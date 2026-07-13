# User Flows — Family Meal Log MVP

Notation: **Happy path** steps are numbered; **fallbacks** are called out inline. The manual
path never depends on AI or network AI calls.

## 1. First-time login
1. User opens the Mini Program.
2. App launches; `cloud.initCloud()` runs. If no env ID is configured → **offline shell
   mode** (manual UI still navigable).
3. When cloud is ready, the client calls the `login` cloud function.
4. `login` returns the server-derived `openid` (and `unionid` if any).
5. App upserts a `users` record and stores `openid` in `globalData`.
6. If the user has no family profile yet → prompt to **create the first family profile**.

_Fallback:_ if login fails, the user can still browse; writes are queued/blocked with a
clear message until identity is resolved.

## 2. Profile selection
1. From home, user taps the profile name.
2. App lists the account's `family_profiles`.
3. User selects one → it becomes the **active profile** (`globalData.activeFamilyProfileId`).
4. Optionally set it as default (`users.defaultFamilyProfileId`).
5. Home refreshes to show that member's date + daily totals.

_Edge:_ no profiles yet → guide to "Add family member".

## 3. Manual meal logging (primary, always available)
1. Home → **添加一餐 (Add meal)**.
2. Select **meal slot** (breakfast/lunch/dinner/snack).
3. **Add food item**:
   - pick from catalog / saved foods, or enter an ad-hoc food;
   - choose a **portion unit** and **quantity**.
4. App converts portion → grams (`gramsFromPortion`) and computes item nutrition
   (`scaleNutrition`).
5. Repeat for more items; meal subtotal updates live (`sumNutrition`).
6. Optional note.
7. **Save** → `mealApi.create`. Server re-validates and **recomputes** `totals`.
8. Return to home; daily totals for the active member update.

_Fallback:_ everything here works with AI disabled/unavailable.

## 4. AI-assisted meal logging (optional, later; mock first)
1. In Add-meal, user chooses **AI 识别 (photo)** (only when enabled).
2. User picks/takes a photo → client uploads to CloudBase Storage → gets `fileID`.
3. Client calls the AI adapter `analyzeMealPhoto({ photoFileId, ... })`.
   - Adapter routes to `aiAnalyze` cloud function if cloud is ready;
   - else falls back to the **local mock provider**.
4. App shows suggestions (food + estimated grams + confidence), clearly labelled as
   estimates.
5. User **confirms/corrects** each suggestion: accept, edit grams/portion, change the food,
   or discard. Nothing counts until confirmed.
6. Confirmed suggestions become normal `MealItem`s (`source = ai_suggested`, `confirmed =
   true`); nutrition is recomputed by the shared layer.
7. **Save** as in the manual flow.

_Fallback:_ if analysis fails or returns nothing → message "请手动添加" and drop to the manual
flow. AI is never required to save a meal.

## 5. Meal editing
1. From daily history, user taps a meal.
2. Edit items (add/remove/change quantity or portion) and/or note.
3. Item and meal subtotals recompute live.
4. **Save** → `mealApi.update`; server re-validates and recomputes `totals`.
5. Daily totals refresh.

## 6. Meal deletion
1. From daily history or meal detail, user taps **删除 (Delete)**.
2. Confirm in a dialog (guard against accidental deletion).
3. `mealApi.delete` removes the meal (owner-checked).
4. Daily totals refresh to exclude it.

## 7. Viewing daily history
1. Home defaults to **today** for the active member.
2. User can change the **date** and/or **family member**.
3. App queries `meals` by (`ownerOpenid`, `familyProfileId`, `date`).
4. Meals are grouped by slot (breakfast → snack) with per-meal totals.
5. **Daily totals** = sum of that day's confirmed item nutrition.

_Empty state:_ "今天还没有记录" with a shortcut to add a meal.
