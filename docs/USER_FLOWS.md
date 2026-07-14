# User Flows — Family Meal Log MVP

Notation: **Happy path** steps are numbered; **fallbacks** are called out inline. The manual
path never depends on AI or network AI calls.

---

## 1. First-time login (M1)

1. User opens the Mini Program.
2. App launches; `cloud.initCloud()` runs. If no env ID is configured → **offline shell
   mode** (manual UI still navigable; identity/profile features show a "未配置云环境" notice).
3. When cloud is ready, the client calls the `login` cloud function.
4. `login` derives the caller's openid **server-side** from the WeChat context, then upserts
   the `users` document (idempotent).
5. `login` returns **only** a non-sensitive internal user id and the server-side
   `defaultFamilyProfileId`. **The openid is never returned to or stored on the client.**
6. The client loads the account's `family_profiles` via `profileApi.list`.
7. If the user has no profile yet → the home screen shows **first-profile onboarding**
   prompting to create the first family member.

_Fallback:_ if login fails, the user sees a clear message; profile features stay disabled
until identity is resolved. No writes are attempted with an unknown identity.

## 2. Profile selection & active profile (M1)

On app start, the active profile is resolved by priority (`resolveActiveProfile`):
1. A locally remembered active profile id that still belongs to the returned list.
2. The server-side `defaultFamilyProfileId`.
3. The first available profile (list is createdAt ascending).
4. If no profiles exist → first-profile onboarding.

Only the **profile id** is remembered locally (in `wx.storage`); ownership credentials are
never stored on the device.

- From home, tap the active-profile card (or "管理家庭成员") → `profiles` page.
- User can **select** a profile → it becomes the active profile for this session (local only;
  does not overwrite the server default unless the user explicitly sets default).
- User can **set a profile as default** → `profileApi.setDefault` updates **only**
  `users.defaultFamilyProfileId` on the server (no profile document is rewritten). The
  per-profile `isDefault` badge shown in the list is computed by the server DTO as
  `profile.id === defaultFamilyProfileId`, so exactly one profile appears as default and
  switching the default never requires a multi-document write.
- Home refreshes to show the selected member's name.

_Edge:_ no profiles yet → guided "创建第一个家庭成员" flow.
_Edge:_ if the stored default id points at a removed/foreign profile, no profile is marked
default (safe fallback) and active-profile resolution falls through to the first profile.

## 3. Create / edit a family profile (M1)

**Create (from onboarding or profiles page):**
1. `profile-edit` page (mode=create): enter **name** + choose **relation**. On page load the
   client generates a stable `requestId` (`req_<time36>_<random>`) for this edit session.
2. Client trims the name and does a fast local check; submit is disabled while in flight
   (duplicate-tap guard).
3. `profileApi.create` validates + normalizes server-side, sets `ownerOpenid` server-side,
   and (for the first profile) auto-sets it as the default. The call carries the `requestId`;
   the server enforces **best-effort request idempotency (尽力式请求幂等)** on
   `(ownerOpenid, 'create', requestId)` — *client in-flight protection plus server-side
   request replay handling* — a retried submit with the same `requestId` returns the originally
   created profile instead of a duplicate. (This is **not** an atomic guarantee; see the race
   note in DATA_MODEL.md / SECURITY.md §3.)
4. On success the new profile becomes the active profile for this session; the list refreshes.

> **Duplicate names are allowed.** There is no name-based deduplication: the same owner may
> intentionally create two profiles with the same `name` (e.g. two children called "宝宝").
> Only accidental *double-submits of the same intent* are collapsed, via the `requestId` +
> the in-flight UI guard — never by comparing names or relations.

**Edit:**
1. From `profiles`, tap 编辑 on a profile → `profile-edit` (mode=edit) pre-filled.
2. Change name/relation → `profileApi.update` (ownership-checked; only `name`/`relation`
   editable).
3. On success the list refreshes.

**Validation feedback (client + server):**
- Empty/whitespace name → "请输入姓名" (client) / `invalid_input` (server).
- Invalid relation → caught by the picker (client) and rejected server-side.
- Unknown/ownership fields in the payload → ignored server-side.
- Duplicate name is **not** an error — it is a valid create (see the note above).

## 4. Add-meal: food catalog & portion preview (M2)

This milestone lets the user build the *intake* half of a meal entry — pick a food, choose a
portion unit + quantity, and see a live nutrition preview — **without persisting anything**. The
"保存这一餐" button is intentionally disabled (meal save is M3).

1. Home → **添加一餐 (Add meal)** → `add-meal` page.
2. (UI-only) Pick a **meal slot** (breakfast/lunch/dinner/snack) — not persisted in M2.
3. **Search** the bundled system catalog (offline-capable) by name / brand / category; results
   stream from `food-catalog.searchFoods`.
4. **Tap a result** → the selected food loads its portion units (food-specific first, then
   `g`/`ml`); the default unit is preselected and the quantity resets to `1`.
5. **Pick a portion unit** and **enter a quantity**. The page computes grams live
   (`quantity × gramsPerUnit`) and the per-100g-scaled nutrition preview
   (kcal/protein/carb/fat, 1 decimal) via `food-catalog.computePreview`. **All nutrition math
   lives in the shared layer; the Page only renders.**
6. **Ad-hoc food:** tap 自定义食品 → enter name/brand/category + per-100g kcal/protein/carb/fat
   → `createAdHocFood` validates (trim, non-negative finite macros), drops unknown fields
   (incl. `ownerOpenid`), and returns a session-only `user`-source food usable immediately for
   preview. **Not persisted** in M2.
7. **No save in M2.** The "保存这一餐" button is disabled and shows "餐食保存将在 M3 实现". The
   page makes **no** `mealApi` call and writes **no** `meals` record.

_Source/version metadata:_ each food shows `nutritionMeta.source` + `nutritionMeta.version`
(e.g. `curated_mvp_seed` for seed foods, `user_entered` for ad-hoc). This is the **provenance of
the nutrition numbers**, distinct from `Food.source` (business origin).

_Fallback:_ the entire flow works offline (the seed catalog is bundled) with **no** cloud call.

## 5. Manual meal logging (M3, planned; primary, always available)

1. Home → **添加一餐 (Add meal)**.
2. Select **meal slot** (breakfast/lunch/dinner/snack).
3. **Add food item**: pick from catalog / saved foods, or enter an ad-hoc food; choose a
   **portion unit** and **quantity**.
4. App converts portion → grams (`gramsFromPortion`) and computes item nutrition
   (`scaleNutrition`).
5. Repeat for more items; meal subtotal updates live (`sumNutrition`).
6. Optional note.
7. **Save** → `mealApi.create`. Server re-validates and **recomputes** `totals`.
8. Return to home; daily totals for the active member update.

_Fallback:_ everything here works with AI disabled/unavailable.

## 6. AI-assisted meal logging (M7, planned; optional, mock first)

1. In Add-meal, user chooses **AI 识别 (photo)** (only when enabled).
2. User picks/takes a photo → client uploads to CloudBase Storage → gets `fileID`.
3. Client calls the AI adapter `analyzeMealPhoto({ photoFileId, ... })`.
4. App shows suggestions, clearly labelled as estimates.
5. User **confirms/corrects** each suggestion.
6. Confirmed suggestions become normal `MealItem`s; nutrition recomputed by the shared layer.
7. **Save** as in the manual flow.

_Fallback:_ if analysis fails → "请手动添加" and drop to the manual flow.

## 7. Meal editing (M4, planned)

1. From daily history, tap a meal.
2. Edit items; subtotal recomputes live.
3. **Save** → `mealApi.update`; server re-validates and recomputes `totals`.

## 8. Meal deletion (M4, planned)

1. Tap **删除 (Delete)**; confirm in a dialog.
2. `mealApi.delete` removes the meal (owner-checked).

> Note: family-profile **deletion** is explicitly out of scope for M1 (see ARCHITECTURE §11).

## 9. Viewing daily history (M4, planned)

1. Home defaults to **today** for the active member (local `YYYY-MM-DD` day).
2. User can change the **date** and/or **family member**.
3. App queries `meals` by (`ownerOpenid`, `familyProfileId`, `date`).
4. Meals grouped by slot; **daily totals** = sum of confirmed item nutrition.

_Empty state:_ "今天还没有记录" with a shortcut to add a meal.
