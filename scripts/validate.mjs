#!/usr/bin/env node
/**
 * Foundation validation / smoke test.
 *
 * Proves the repository foundation is internally consistent WITHOUT any real
 * credentials, network, or WeChat runtime. Two layers of checks:
 *   A. Structural  - required files exist and cross-references resolve.
 *   B. Logic       - the shared nutrition + validation layer behaves correctly
 *                    against deterministic fixtures.
 *
 * Exit code 0 = all checks passed; non-zero = at least one failure.
 */
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

let passed = 0;
let failed = 0;
const failures = [];

function check(name, condition) {
  if (condition) {
    passed += 1;
    console.log(`  \u2713 ${name}`);
  } else {
    failed += 1;
    failures.push(name);
    console.log(`  \u2717 ${name}`);
  }
}

function fileExists(rel) {
  return existsSync(join(ROOT, rel));
}

function readJson(rel) {
  return JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
}

// ---------------------------------------------------------------------------
console.log('\n[A] Structural checks');

// A1. Required top-level artifacts.
const requiredFiles = [
  'README.md',
  '.gitignore',
  '.env.example',
  'package.json',
  'tsconfig.json',
  'project.config.json',
  'docs/PRODUCT_REQUIREMENTS.md',
  'docs/ARCHITECTURE.md',
  'docs/DATA_MODEL.md',
  'docs/USER_FLOWS.md',
  'docs/DEVELOPMENT_PLAN.md',
  'miniprogram/app.ts',
  'miniprogram/app.json',
  'miniprogram/app.wxss',
  'shared/index.ts',
  'shared/nutrition.ts',
  'shared/validation.ts',
];
for (const f of requiredFiles) check(`exists: ${f}`, fileExists(f));

// A2. Every page in app.json has its 4 source files.
const appJson = readJson('miniprogram/app.json');
check('app.json has >= 1 page', Array.isArray(appJson.pages) && appJson.pages.length > 0);
for (const page of appJson.pages) {
  for (const ext of ['ts', 'json', 'wxml', 'wxss']) {
    check(`page file: miniprogram/${page}.${ext}`, fileExists(`miniprogram/${page}.${ext}`));
  }
}

// A3. Every cloud function has index.js + package.json + config.json.
const cloudFns = ['login', 'mealApi', 'aiAnalyze'];
for (const fn of cloudFns) {
  for (const f of ['index.js', 'package.json', 'config.json']) {
    check(`cloudfn: cloudfunctions/${fn}/${f}`, fileExists(`cloudfunctions/${fn}/${f}`));
  }
}

// A4. Security: no real CloudBase env ID committed in client env config.
const envTs = readFileSync(join(ROOT, 'miniprogram/config/env.ts'), 'utf8');
check(
  'env.ts contains no non-empty cloudEnvId literal',
  !/cloudEnvId:\s*['"][^'"]+['"]/.test(envTs) ||
    /cloudEnvId:\s*['"]{2}/.test(envTs),
);
// A5. Security: .gitignore protects secrets and private config.
const gitignore = readFileSync(join(ROOT, '.gitignore'), 'utf8');
check('.gitignore ignores .env', /(^|\n)\.env(\n|$|\*)/.test(gitignore));
check('.gitignore ignores project.private.config.json', gitignore.includes('project.private.config.json'));

// ---------------------------------------------------------------------------
console.log('\n[B] Logic checks (shared nutrition + validation)');

const distIndex = join(ROOT, 'shared/dist/index.js');
if (!existsSync(distIndex)) {
  check('shared/dist built (run: npm run build:shared)', false);
} else {
  const shared = require(distIndex);
  const {
    gramsFromPortion,
    scaleNutrition,
    sumNutrition,
    caloriesFromMacros,
    isCalorieMacroConsistent,
    validateMeal,
    validateFood,
    buildSampleMeal,
    MEAL_TYPES,
  } = shared;

  // B1. Portion -> gram conversion.
  check('gramsFromPortion(2, 60) === 120', gramsFromPortion(2, 60) === 120);

  // B2. Scaling per-100g density.
  const scaled = scaleNutrition({ calories: 130, protein: 2.7, carb: 28, fat: 0.3 }, 150);
  check('scaleNutrition rice 150g calories === 195', scaled.calories === 195);

  // B3. Summation.
  const total = sumNutrition([
    { calories: 100, protein: 5, carb: 10, fat: 2 },
    { calories: 50, protein: 1, carb: 8, fat: 1 },
  ]);
  check('sumNutrition calories === 150', total.calories === 150);
  check('sumNutrition protein === 6', total.protein === 6);

  // B4. Atwater macro->calorie factor.
  check('caloriesFromMacros(10,20,5) === 165', caloriesFromMacros(10, 20, 5) === 165);
  check('chicken breast is calorie/macro consistent', isCalorieMacroConsistent({ calories: 165, protein: 31, carb: 0, fat: 3.6 }));

  // B5. Sample meal totals equal the sum of its item nutrition (self-consistent).
  const meal = buildSampleMeal();
  const recomputed = sumNutrition(meal.items.map((i) => i.nutrition));
  check('sample meal totals match recomputed item sum', recomputed.calories === meal.totals.calories && recomputed.protein === meal.totals.protein);
  check('sample meal mealType is valid', MEAL_TYPES.includes(meal.mealType));

  // B6. Validation accepts a good meal.
  const good = validateMeal(meal);
  check('validateMeal(sample) is valid', good.valid === true);

  // B7. Validation rejects a bad meal (missing required fields).
  const bad = validateMeal({ items: 'nope' });
  check('validateMeal(bad) is invalid', bad.valid === false && bad.errors.length > 0);

  // B8. Validation rejects a food with negative calories.
  const badFood = validateFood({ name: 'X', per100g: { calories: -1, protein: 0, carb: 0, fat: 0 }, source: 'system', isSaved: false });
  check('validateFood(negative calories) is invalid', badFood.valid === false);

  // B9. Guard: negative gram conversion throws.
  let threw = false;
  try {
    gramsFromPortion(1, 0);
  } catch {
    threw = true;
  }
  check('gramsFromPortion rejects gramsPerUnit <= 0', threw);
}

// ---------------------------------------------------------------------------
console.log('\n[C] M1 — identity & family profiles');

function isGitIgnored(rel) {
  return spawnSync('git', ['check-ignore', '-q', rel], { cwd: ROOT }).status === 0;
}

if (!existsSync(distIndex)) {
  check('M1: shared runtime built (run: npm run build:shared)', false);
} else {
  const shared = require(distIndex);
  const {
    InMemoryRepository,
    upsertUser,
    listProfiles,
    createProfile,
    updateProfile,
    setDefaultProfile,
    getProfile,
    toClientProfile,
    isServiceError,
    resolveActiveProfile,
  } = shared;

  // 1. Login upsert is idempotent.
  {
    const repo = new InMemoryRepository();
    const a = await upsertUser(repo, 'openid_A');
    const b = await upsertUser(repo, 'openid_A');
    const c = await upsertUser(repo, 'openid_A');
    check(
      '1. login upsert idempotent (same identity, isNew only first time)',
      a.isNew === true && b.isNew === false && c.isNew === false && a.user.openid === b.user.openid,
    );
  }

  // 2. First profile becomes default.
  {
    const repo = new InMemoryRepository();
    await upsertUser(repo, 'u1');
    const p = await createProfile(repo, 'u1', { name: '爸爸', relation: 'self' });
    const u = await repo.findUserByOpenid('u1');
    check('2. first profile auto-set as default', u.defaultFamilyProfileId === p._id);
  }

  // 3. A user can create at least two profiles.
  {
    const repo = new InMemoryRepository();
    await upsertUser(repo, 'u1');
    const p1 = await createProfile(repo, 'u1', { name: '爸爸', relation: 'self' });
    const p2 = await createProfile(repo, 'u1', { name: '妈妈', relation: 'spouse' });
    const list = await listProfiles(repo, 'u1');
    check('3. user can create >= 2 profiles', list.length === 2 && p1._id !== p2._id);
  }

  // 4. Profile names are trimmed.
  {
    const repo = new InMemoryRepository();
    await upsertUser(repo, 'u3');
    const t = await createProfile(repo, 'u3', { name: '  小李  ', relation: 'child' });
    check('4. profile name is trimmed', t.name === '小李');
  }

  // 5. Empty names are rejected.
  {
    const repo = new InMemoryRepository();
    await upsertUser(repo, 'u3');
    let threw = false;
    try {
      await createProfile(repo, 'u3', { name: '   ', relation: 'child' });
    } catch (e) {
      threw = isServiceError(e) && e.code === 'validation';
    }
    check('5. empty/whitespace name rejected', threw);
  }

  // 6. Invalid relations are rejected.
  {
    const repo = new InMemoryRepository();
    await upsertUser(repo, 'u3');
    let threw = false;
    try {
      await createProfile(repo, 'u3', { name: '机器人', relation: 'robot' });
    } catch (e) {
      threw = isServiceError(e) && e.code === 'validation';
    }
    check('6. invalid relation rejected', threw);
  }

  // 7. Unknown input fields are not persisted.
  {
    const repo = new InMemoryRepository();
    await upsertUser(repo, 'u4');
    const created = await createProfile(repo, 'u4', {
      name: '小王',
      relation: 'other',
      ownerOpenid: 'attacker',
      _id: 'hack',
      isAdmin: true,
      heightCm: 180,
    });
    const got = await repo.getProfile(created._id);
    check(
      '7. unknown fields not persisted (ownerOpenid server-set, extras dropped)',
      got.ownerOpenid === 'u4' &&
        (got).isAdmin === undefined &&
        (got).heightCm === undefined,
    );
  }

  // 8. Client-supplied ownerOpenid is ignored.
  {
    const repo = new InMemoryRepository();
    await upsertUser(repo, 'u4');
    const hack = await createProfile(repo, 'u4', {
      name: '黑客',
      relation: 'other',
      ownerOpenid: 'SOME_OTHER_OPENID',
    });
    const got = await repo.getProfile(hack._id);
    check('8. client-supplied ownerOpenid ignored', got.ownerOpenid === 'u4');
  }

  // 9-11. Cross-user isolation (list / update / setDefault).
  {
    const repo = new InMemoryRepository();
    await upsertUser(repo, 'owner');
    await upsertUser(repo, 'stranger');
    await createProfile(repo, 'owner', { name: 'A', relation: 'self' });
    await createProfile(repo, 'owner', { name: 'B', relation: 'spouse' });
    const ownerList = await listProfiles(repo, 'owner');
    const targetId = ownerList[0]._id;

    const strangerList = await listProfiles(repo, 'stranger');
    check('9. user cannot list another user’s profiles', strangerList.length === 0);

    let threwUpdate = false;
    try {
      await updateProfile(repo, 'stranger', targetId, { name: 'Hacked', relation: 'other' });
    } catch (e) {
      threwUpdate = isServiceError(e) && (e.code === 'forbidden' || e.code === 'not_found');
    }
    const afterUpdate = await repo.getProfile(targetId);
    check('10. user cannot update another user’s profile', threwUpdate && afterUpdate.name === 'A');

    let threwSet = false;
    try {
      await setDefaultProfile(repo, 'stranger', targetId);
    } catch (e) {
      threwSet = isServiceError(e) && (e.code === 'forbidden' || e.code === 'not_found');
    }
    const strangerUser = await repo.findUserByOpenid('stranger');
    check(
      '11. user cannot set another user’s profile as default',
      threwSet && strangerUser.defaultFamilyProfileId === undefined,
    );
  }

  // 12. Stale local active-profile id falls back correctly.
  {
    const repo = new InMemoryRepository();
    await upsertUser(repo, 'fb');
    await createProfile(repo, 'fb', { name: 'A', relation: 'self' });
    await createProfile(repo, 'fb', { name: 'B', relation: 'spouse' });
    const list = await listProfiles(repo, 'fb');

    const r1 = resolveActiveProfile(list, 'stale_id', list[0]._id);
    check('12a. stale local id -> server default', !!r1 && r1._id === list[0]._id);

    const r2 = resolveActiveProfile(list, 'stale_id', undefined);
    check('12b. stale local id -> first profile', !!r2 && r2._id === list[0]._id);

    const r3 = resolveActiveProfile([], 'stale_id', undefined);
    check('12c. no profiles -> onboarding (undefined)', r3 === undefined);
  }

  // 13. Default profile persists across a fresh login/session.
  {
    const repo = new InMemoryRepository();
    await upsertUser(repo, 'puser');
    await createProfile(repo, 'puser', { name: '爸爸', relation: 'self' });
    await createProfile(repo, 'puser', { name: '妈妈', relation: 'spouse' });
    const list = await listProfiles(repo, 'puser');
    const secondId = list[1]._id;
    await setDefaultProfile(repo, 'puser', secondId);

    const relogin = await upsertUser(repo, 'puser'); // fresh login
    check('13. default persists across fresh login', relogin.user.defaultFamilyProfileId === secondId);
  }

  // 14. Repeated submit does not create duplicate profiles.
  {
    const repo = new InMemoryRepository();
    await upsertUser(repo, 'duser');
    const first = await createProfile(repo, 'duser', { name: '小明', relation: 'child' });
    const second = await createProfile(repo, 'duser', { name: '小明', relation: 'child' });
    const list = await listProfiles(repo, 'duser');
    check('14. duplicate submit returns same profile (no dup)', first._id === second._id && list.length === 1);
  }

  // 15. Shared runtime is packaged into the affected cloud-function builds.
  {
    const loginShared = existsSync(join(ROOT, 'cloudfunctions/login/lib/shared/index.js')) &&
      existsSync(join(ROOT, 'cloudfunctions/login/lib/shared/services/profile-service.js'));
    const profileShared = existsSync(join(ROOT, 'cloudfunctions/profileApi/lib/shared/index.js')) &&
      existsSync(join(ROOT, 'cloudfunctions/profileApi/lib/shared/services/profile-service.js'));
    check('15a. shared runtime packaged in login', loginShared);
    check('15b. shared runtime packaged in profileApi', profileShared);

    const loginSrc = readFileSync(join(ROOT, 'cloudfunctions/login/index.js'), 'utf8');
    const profileSrc = readFileSync(join(ROOT, 'cloudfunctions/profileApi/index.js'), 'utf8');
    check(
      '15c. login cloud function uses shared runtime',
      /require\(['"]\.\/lib\/shared\/services\/user-service['"]\)/.test(loginSrc),
    );
    check(
      '15d. profileApi cloud function uses shared runtime',
      /require\(['"]\.\/lib\/shared\/services\/profile-service['"]\)/.test(profileSrc),
    );
  }

  // 16. No secrets or environment IDs are committed.
  {
    const gi = readFileSync(join(ROOT, '.gitignore'), 'utf8');
    check('.gitignore ignores generated shared runtime', gi.includes('cloudfunctions/*/lib/shared/'));
    check(
      'generated shared runtime is git-ignored',
      isGitIgnored('cloudfunctions/login/lib/shared/index.js'),
    );

    const typings = readFileSync(join(ROOT, 'typings/index.d.ts'), 'utf8');
    // Allow "openid" only in prose (e.g. "Never an openid."); forbid an actual field.
    check('client globalData does not store openid', !/openid\s*[:?]/.test(typings));

    const appSrc = readFileSync(join(ROOT, 'miniprogram/app.ts'), 'utf8');
    check('app.ts does not assign openid to globalData', !/globalData\.\w*openid/.test(appSrc));

    const loginSrc = readFileSync(join(ROOT, 'cloudfunctions/login/index.js'), 'utf8');
    check('login response does not return openid', !/user:\s*\{[^}]*openid/.test(loginSrc));
  }
}

// ---------------------------------------------------------------------------
console.log(`\nResult: ${passed} passed, ${failed} failed.`);
if (failed > 0) {
  console.log('Failed checks:\n - ' + failures.join('\n - '));
  process.exit(1);
}
console.log('Foundation + M1 are internally consistent. \u2713');
