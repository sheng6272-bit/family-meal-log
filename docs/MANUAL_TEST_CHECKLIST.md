# Manual Acceptance Test Checklist — M1

These steps verify M1 behaviour in the real WeChat runtime (Developer Tools and a phone).
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

## Notes

- **Deletion** is intentionally absent in M1 (deferred) — there is no delete control.
- **Ownership** cannot be exercised manually; it is enforced server-side. To sanity-check
  isolation, log in with a second test WeChat account and confirm it sees only its own
  profiles (empty initially), never the first account's data.
