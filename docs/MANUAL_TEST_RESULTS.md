# Manual Test Results — M1 (Family Meal Log MVP)

Status legend: **Pending** (not yet executed) · **Pass** · **Fail** · **Blocked**

> **Important:** This sheet is filled in by the product owner during WeChat DevTools and
> real-device acceptance. As of the M1 closeout, **every case below is Pending** — the
> automated suite (`npm run validate`, 91/91) is the only execution evidence we have. The
> report's "DevTools manual tests" and "Real-device tests" sections mirror this sheet.
>
> The file contains **28 executable rows in total**: 14 DevTools rows + 14 real-device rows
> (same 14 cases, executed on a physical phone against the configured CloudBase dev
> environment). No manual test is marked passed until there is actual execution evidence.

## A. WeChat DevTools (simulator) tests

| # | Test | Environment | Status | Actual result | Screenshot / reference | Notes |
|---|------|-------------|--------|---------------|------------------------|-------|
| 1 | First login and onboarding | DevTools | Pending | | | First run should enter onboarding |
| 2 | Create first profile | DevTools | Pending | | | First profile auto-becomes default |
| 3 | First profile becomes default | DevTools | Pending | | | Verify default badge on list |
| 4 | Create second profile | DevTools | Pending | | | |
| 5 | Switch active profile | DevTools | Pending | | | Local-only until explicitly set default |
| 6 | Set another profile as default | DevTools | Pending | | | Only `users.defaultFamilyProfileId` changes |
| 7 | Restart / recompile, confirm default persistence | DevTools | Pending | | | Default survives a fresh compile/login |
| 8 | Edit profile | DevTools | Pending | | | Name/relation editable; ownership fixed |
| 9 | Empty-name rejection | DevTools | Pending | | | Client "请输入姓名" + server `invalid_input` |
| 10 | Invalid-relation rejection | DevTools | Pending | | | Picker limits enum; server rejects |
| 11 | Rapid repeated submission creates only one record | DevTools | Pending | | | `requestId` best-effort replay handling + UI in-flight guard (not atomic) |
| 12 | Two separate submissions with identical names create two profiles | DevTools | Pending | | | Names are not a uniqueness key |
| 13 | Offline / unconfigured-cloud state does not crash | DevTools | Pending | | | Home shows offline banner |
| 14 | Clear local storage → verify fallback | DevTools | Pending | | | server default → first profile → onboarding when none |

## B. Real-device (physical phone) tests

The same 14 cases, repeated on a real device against the configured CloudBase dev
environment. Status starts **Pending** until executed.

| # | Test | Environment | Status | Actual result | Screenshot / reference | Notes |
|---|------|-------------|--------|---------------|------------------------|-------|
| 1 | First login and onboarding | Real device | Pending | | | First run should enter onboarding |
| 2 | Create first profile | Real device | Pending | | | First profile auto-becomes default |
| 3 | First profile becomes default | Real device | Pending | | | Verify default badge on list |
| 4 | Create second profile | Real device | Pending | | | |
| 5 | Switch active profile | Real device | Pending | | | Local-only until explicitly set default |
| 6 | Set another profile as default | Real device | Pending | | | Only `users.defaultFamilyProfileId` changes |
| 7 | Restart / recompile, confirm default persistence | Real device | Pending | | | Default survives a fresh compile/login |
| 8 | Edit profile | Real device | Pending | | | Name/relation editable; ownership fixed |
| 9 | Empty-name rejection | Real device | Pending | | | Client "请输入姓名" + server `invalid_input` |
| 10 | Invalid-relation rejection | Real device | Pending | | | Picker limits enum; server rejects |
| 11 | Rapid repeated submission creates only one record | Real device | Pending | | | `requestId` best-effort replay handling + UI in-flight guard (not atomic) |
| 12 | Two separate submissions with identical names create two profiles | Real device | Pending | | | Names are not a uniqueness key |
| 13 | Offline / unconfigured-cloud state does not crash | Real device | Pending | | | Home shows offline banner |
| 14 | Clear local storage → verify fallback | Real device | Pending | | | server default → first profile → onboarding when none |

## How to execute (summary)

1. Put the CloudBase dev env ID in `miniprogram/config/env.local.ts` (git-ignored).
2. `npm run build:shared` to package the shared runtime into each cloud function.
3. Open the project in WeChat DevTools; upload/deploy `login` and `profileApi`.
4. Walk DevTools cases A.1–A.14; for case 11 tap "save" rapidly; for case 12 submit two
   separate same-name profiles.
5. On a phone, repeat the same cases (B.1–B.14) in preview/experience mode; verify the offline
   banner (case 13) and storage-clear fallback (case 14).
6. Record `Pass`/`Fail`/`Blocked`, attach a screenshot path in the reference column, and note
   any deviation. Feed results back into `docs/M1-FINAL-REPORT.md` §17.
