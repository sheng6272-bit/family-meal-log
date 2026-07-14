# Manual Acceptance Test Checklist — M1 & M2

These steps verify M1 / M2 behaviour in the real WeChat runtime (Developer Tools and a phone).
The automated `npm run validate` already covers the logic/authorization; this checklist
covers the on-device experience that cannot be exercised headlessly.

> Prereqs: a CloudBase `dev` environment exists; `miniprogram/config/env.local.ts` sets a
> real `cloudEnvId` for `dev`; cloud functions `login` and `profileApi` are uploaded (after
> `npm run build:shared`).

## A. WeChat Developer Tools

1. **First login**
   - Clear storage (Tools → Clear Cache → Clear All), compile & run.
   - Expected: app boots; after `login`, the home screen shows either onboarding
     ("还没有家庭成员") or an active profile. No crash; no openid shown anywhere.

2. **Create the first profile**
   - Tap "创建第一个家庭成员" → enter name "爸爸", relation "本人" → 创建成员.
   - Expected: returns to profiles/home; the new profile is shown and marked **默认** and
     **当前**.

3. **Confirm it becomes active and default**
   - Home shows "爸爸" as the active profile.
   - (Backend) `users.defaultFamilyProfileId` equals this profile's `_id`.

4. **Create a second profile**
   - Profiles → 添加成员 → "妈妈", relation "配偶".
   - Expected: two profiles listed; "爸爸" still default.

5. **Switch between profiles**
   - Tap 选择 on "妈妈". Expected: home now shows "妈妈" as current. Server default unchanged
     (still "爸爸").

6. **Set the second profile as default**
   - On "妈妈", tap 设为默认. Expected: "妈妈" gets the **默认** badge; later logins resolve
     "妈妈" as the default.

7. **Close and reopen the Mini Program**
   - Stop and re-run (or kill + reopen on phone). Expected: the last selected profile ("妈妈"
     if set default, else last active) is restored per the active-profile priority.

8. **Confirm remembered/default behaviour**
   - After reopen, home reflects the expected active profile without re-creating anything.

9. **Edit a profile**
   - Profiles → 编辑 on "爸爸" → change name to "老爸" → 保存修改.
   - Expected: list updates; no new profile created; ownership unchanged.

10. **Attempt invalid input**
    - Create/edit with empty name → "请输入姓名"; submit blocked.
    - Relation picker only allows the 5 valid values (no invalid option reachable).

11. **Simulate network / cloud-function failure**
    - Temporarily misconfigure the env ID (blank `cloudEnvId`) and run.
    - Expected: home shows "离线模式 / 未配置云环境"; profile features show a clear notice;
      no silent "success". Restore the env ID afterwards.

## B. Real phone (preview / experience version)

- Repeat steps 1–10 via a preview QR / experience version against the **dev** environment.
- Verify Chinese messages render correctly and taps (create/select/set-default) behave as in
  Tools.
- Kill the app from the multitask view and reopen to confirm the persisted active/default
  behaviour on a real device.

## C. M2 — Food catalog & portion units (add-meal page)

> Prereqs: `miniprogram/lib/shared/` is generated (`npm run build:shared`). The add-meal page
> uses the **bundled seed catalog**, so it works with or without a cloud env configured.

1. **Open add-meal** — Home → 添加一餐. Expected: meal-slot selector visible; search box,
   empty result area, and a disabled "保存这一餐" button. No crash.
2. **Empty search** — leave the box empty. Expected: all seed foods listed (≥ 8), each with
   name, category and per-100g hint.
3. **Chinese partial search** — type "米饭". Expected: cooked white rice appears; partial
   match works.
4. **Category search** — type "肉类". Expected: only meat foods listed; each row's category is
   肉类.
5. **Case-insensitive English** — (if any English names present) search "APPLE" and "apple"
   return the same set.
6. **No-match** — type "zzz_no_such_food". Expected: empty list, no crash, a clear empty
   hint.
7. **Whitespace trim** — search " 米饭 " (padded). Expected: same results as "米饭".
8. **Select a seed food** — tap cooked white rice. Expected: portion-unit picker shows the
   food-specific units first (碗 / 小碗 …) followed by `g` and `ml`.
9. **Default unit preselected** — for rice the default (碗) is highlighted.
10. **Quantity default** — quantity field shows `1` after selecting a food.
11. **Unit change** — switch to `g`. Expected: preview grams updates to `quantity × 1`.
12. **Quantity change** — set quantity `2`. Expected: grams double and kcal/protein/carb/fat
    double vs quantity `1`.
13. **Fractional + bowl** — pick 碗 (≈150 g) and quantity `1.5`. Expected: ~225 g and
    proportionally scaled nutrition.
14. **One-decimal preview** — nutrition values show exactly one decimal (e.g. 174.0 kcal).
15. **Source/version metadata** — the selected seed food shows `curated_mvp_seed` / `1`
    (provenance of the nutrition numbers, distinct from business `source`).
16. **Open custom form** — tap 自定义食品. Expected: form with name / brand / category / 4
    per-100g number inputs appears.
17. **Valid custom food** — enter "盐", kcal 0 / protein 0 / carb 0 / fat 0 → 添加. Expected:
    the food is added and immediately selectable for a preview (session-only).
18. **Custom metadata** — the ad-hoc food shows `user_entered` / `1` provenance.
19. **Invalid: empty name** — submit with blank name → error "食品名称不能为空"; not added.
20. **Invalid: negative calories** — enter name "x", calories `-5` → error; not added.
21. **Invalid: non-numeric macro** — enter a letter in a macro field → error; not added.
22. **Duplicate-tap guard** — rapidly tap 添加 twice on a valid form → exactly one food is
    added (no double submit).
23. **No save in M2** — tap 保存这一餐. Expected: button is disabled and a note "餐食保存将在
    M3 实现" is shown; **no** network call to `mealApi` and **no** `meals` record is created
    (verify the Network panel is empty on tap).
24. **Offline** — with `cloudEnvId` blank, repeat steps 2–15. Expected: search + preview still
    work (seed catalog is bundled); no cloud call required.

## Notes

- **Deletion** is intentionally absent in M1 (deferred) — there is no delete control.
- **Ownership** cannot be exercised manually; it is enforced server-side. To sanity-check
  isolation, log in with a second test WeChat account and confirm it sees only its own
  profiles (empty initially), never the first account's data.
- **M2 does not persist anything.** Ad-hoc foods live only for the session; meals are saved in
  M3. The add-meal save button is intentionally disabled.
