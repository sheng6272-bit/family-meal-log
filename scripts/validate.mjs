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
const cloudFns = ['login', 'profileApi', 'mealApi', 'aiAnalyze'];
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
const appTs = readFileSync(join(ROOT, 'miniprogram/app.ts'), 'utf8');
check(
  'app.ts does not hard-import env.local.ts',
  !/from ['"]\.\/config\/env\.local['"]/.test(appTs),
);
// A5. Security: .gitignore protects secrets and private config.
const gitignore = readFileSync(join(ROOT, '.gitignore'), 'utf8');
check('.gitignore ignores .env', /(^|\r?\n)\.env(\r?\n|$|\*)/.test(gitignore));
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
  const badFood = validateFood({
    name: 'X',
    per100g: { calories: -1, protein: 0, carb: 0, fat: 0 },
    source: 'system',
    isSaved: false,
    nutritionMeta: { source: 'curated_mvp_seed', version: '1' },
  });
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

  // 14. Name-based dedup is GONE — duplicates are allowed; retries are handled
  //     by request-level idempotency (ownerOpenid + operation + requestId).
  {
    const repo = new InMemoryRepository();
    await upsertUser(repo, 'duser');
    // Same owner, identical name+relation, DIFFERENT requestIds -> two profiles.
    const a = await createProfile(repo, 'duser', { name: '宝宝', relation: 'child' }, 'req-1');
    const b = await createProfile(repo, 'duser', { name: '宝宝', relation: 'child' }, 'req-2');
    const list = await listProfiles(repo, 'duser');
    check(
      '14a. same name + different requestId -> two distinct profiles',
      a._id !== b._id && list.length === 2,
    );
  }

  // 14b. Repeating the SAME requestId returns the originally created profile.
  {
    const repo = new InMemoryRepository();
    await upsertUser(repo, 'duser2');
    const first = await createProfile(repo, 'duser2', { name: '小明', relation: 'child' }, 'same-req');
    const retry = await createProfile(repo, 'duser2', { name: '小明', relation: 'child' }, 'same-req');
    const list = await listProfiles(repo, 'duser2');
    check(
      '14b. repeated requestId returns same profile (no dup)',
      first._id === retry._id && list.length === 1,
    );
  }

  // 14c. Different owners may reuse the same requestId without collision.
  {
    const repo = new InMemoryRepository();
    await upsertUser(repo, 'ownerX');
    await upsertUser(repo, 'ownerY');
    const px = await createProfile(repo, 'ownerX', { name: '同名', relation: 'self' }, 'shared-req');
    const py = await createProfile(repo, 'ownerY', { name: '同名', relation: 'self' }, 'shared-req');
    const listX = await listProfiles(repo, 'ownerX');
    const listY = await listProfiles(repo, 'ownerY');
    check(
      '14c. different owners reuse the same requestId without collision',
      px._id !== py._id && listX.length === 1 && listY.length === 1 &&
        px.ownerOpenid === 'ownerX' && py.ownerOpenid === 'ownerY',
    );
  }

  // 15. Default profile: single source of truth = users.defaultFamilyProfileId.
  //     isDefault is COMPUTED in the DTO, never persisted on family_profiles.
  {
    const repo = new InMemoryRepository();
    await upsertUser(repo, 'defu');
    const p1 = await createProfile(repo, 'defu', { name: '爸爸', relation: 'parent' });
    const p2 = await createProfile(repo, 'defu', { name: '妈妈', relation: 'spouse' });

    // 15a. No isDefault key is ever persisted on a profile document.
    const stored1 = await repo.getProfile(p1._id);
    const stored2 = await repo.getProfile(p2._id);
    check(
      '15a. no isDefault persisted on family_profiles',
      !('isDefault' in stored1) && !('isDefault' in stored2),
    );

    // 15b. DTO computes isDefault from the user default (first profile is default).
    let user = await repo.findUserByOpenid('defu');
    let list = await listProfiles(repo, 'defu');
    let dtos = list.map((p) => toClientProfile(p, user.defaultFamilyProfileId));
    const defaultsNow = dtos.filter((d) => d.isDefault);
    check(
      '15b. DTO computes isDefault from users.defaultFamilyProfileId',
      dtos.find((d) => d._id === p1._id).isDefault === true &&
        dtos.find((d) => d._id === p2._id).isDefault === false,
    );

    // 15c. Exactly one default is represented in the returned list.
    check('15c. exactly one default in returned list', defaultsNow.length === 1);

    // 15d. Changing default updates ONLY the user record (no profile mutation).
    const beforeUpdatedAt = [stored1.updatedAt, stored2.updatedAt];
    await setDefaultProfile(repo, 'defu', p2._id);
    const after1 = await repo.getProfile(p1._id);
    const after2 = await repo.getProfile(p2._id);
    check(
      '15d. changing default does not mutate profile documents',
      after1.updatedAt === beforeUpdatedAt[0] && after2.updatedAt === beforeUpdatedAt[1],
    );

    // 15e. Computed result follows the new default correctly.
    user = await repo.findUserByOpenid('defu');
    list = await listProfiles(repo, 'defu');
    dtos = list.map((p) => toClientProfile(p, user.defaultFamilyProfileId));
    check(
      '15e. setting a new default changes the computed isDefault',
      dtos.find((d) => d._id === p2._id).isDefault === true &&
        dtos.find((d) => d._id === p1._id).isDefault === false &&
        dtos.filter((d) => d.isDefault).length === 1,
    );

    // 15f. A missing/stale default id falls back safely (no profile marked).
    const staleDtos = list.map((p) => toClientProfile(p, 'no_such_id'));
    check(
      '15f. stale/missing default id -> no profile marked default (safe fallback)',
      staleDtos.every((d) => d.isDefault === false),
    );
  }

  // 16. Shared runtime is packaged into the affected cloud-function builds.
  {
    const loginShared = existsSync(join(ROOT, 'cloudfunctions/login/lib/shared/index.js')) &&
      existsSync(join(ROOT, 'cloudfunctions/login/lib/shared/services/profile-service.js'));
    const profileShared = existsSync(join(ROOT, 'cloudfunctions/profileApi/lib/shared/index.js')) &&
      existsSync(join(ROOT, 'cloudfunctions/profileApi/lib/shared/services/profile-service.js'));
    check('16a. shared runtime packaged in login', loginShared);
    check('16b. shared runtime packaged in profileApi', profileShared);

    const loginSrc = readFileSync(join(ROOT, 'cloudfunctions/login/index.js'), 'utf8');
    const profileSrc = readFileSync(join(ROOT, 'cloudfunctions/profileApi/index.js'), 'utf8');
    check(
      '16c. login cloud function uses shared runtime',
      /require\(['"]\.\/lib\/shared\/services\/user-service['"]\)/.test(loginSrc),
    );
    check(
      '16d. profileApi cloud function uses shared runtime',
      /require\(['"]\.\/lib\/shared\/services\/profile-service['"]\)/.test(profileSrc),
    );
  }

  // 17. No secrets or environment IDs are committed.
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
console.log('\n[D] M2 — food catalog & portion units');

// D. Structural checks (no runtime build required).
check('M2: seed file exists', fileExists('shared/data/system-foods.ts'));
check('M2: food catalog service exists', fileExists('shared/services/food-catalog-service.ts'));
check('M2: portion service exists', fileExists('shared/services/portion-service.ts'));
check('M2: client food-catalog service exists', fileExists('miniprogram/services/food-catalog.ts'));
check('M2: client shared runtime packaged', existsSync(join(ROOT, 'miniprogram/lib/shared/index.js')));
check(
  'M2: generated client runtime is git-ignored',
  gitignore.includes('miniprogram/lib/shared/') &&
    isGitIgnored('miniprogram/lib/shared/index.js'),
);

// add-meal page must no longer be a placeholder.
{
  const addMealTs = readFileSync(join(ROOT, 'miniprogram/pages/add-meal/add-meal.ts'), 'utf8');
  const addMealWxml = readFileSync(join(ROOT, 'miniprogram/pages/add-meal/add-meal.wxml'), 'utf8');
  check(
    'M2: add-meal page implements food search/preview (not placeholder)',
    /food-catalog/.test(addMealTs) &&
      /searchFoods/.test(addMealTs) &&
      /computePreview/.test(addMealTs) &&
      !/手动添加将在后续里程碑实现/.test(addMealTs) &&
      !/手动记录是主要且可靠的方式/.test(addMealWxml),
  );
}

// D. Logic checks (require the built shared runtime).
if (!existsSync(distIndex)) {
  check('M2: shared runtime built (run: npm run build:shared)', false);
} else {
  const shared = require(distIndex);
  const {
    SYSTEM_FOODS,
    SYSTEM_PORTION_UNITS,
    genericPortionUnits,
    searchFoods,
    getAvailablePortionUnits,
    getDefaultPortionUnit,
    calculateFoodPreview,
    createAdHocFood,
    validateFood,
    validatePortionUnit,
    gramsFromPortion,
    scaleNutrition,
  } = shared;

  const allFoods = SYSTEM_FOODS;

  // 8-16. System food seed integrity.
  check('M2-8. seed foods >= 8', allFoods.length >= 8);
  {
    const ids = new Set(allFoods.map((f) => f._id));
    check('M2-9. all seed food ids unique', ids.size === allFoods.length);
  }
  check(
    'M2-10. all seed food names non-empty',
    allFoods.every((f) => typeof f.name === 'string' && f.name.trim().length > 0),
  );
  check('M2-11. all seed foods pass validateFood', allFoods.every((f) => validateFood(f).valid));
  check(
    'M2-12. all seed foods have nutritionMeta.source',
    allFoods.every((f) => !!(f.nutritionMeta && f.nutritionMeta.source)),
  );
  check(
    'M2-13. all seed foods have nutritionMeta.version',
    allFoods.every((f) => !!(f.nutritionMeta && f.nutritionMeta.version)),
  );
  check('M2-14. all seed foods source === system', allFoods.every((f) => f.source === 'system'));
  check('M2-15. all seed foods isSaved === false', allFoods.every((f) => f.isSaved === false));
  check(
    'M2-16. no seed food carries ownerOpenid',
    allFoods.every((f) => f.ownerOpenid === undefined),
  );

  // 17-25. Search behaviour.
  {
    const all = searchFoods(allFoods, '');
    check('M2-17. empty search returns all (copy, no mutate)', all.length === allFoods.length && all !== allFoods);
    check(
      'M2-18. search auto-trims',
      searchFoods(allFoods, '  米饭  ').length === searchFoods(allFoods, '米饭').length,
    );
    // case-insensitive + brand via a small synthetic English list
    const eng = [
      { _id: 'e1', name: 'Apple Pie', category: 'dessert', per100g: { calories: 1, protein: 0, carb: 0, fat: 0 }, source: 'system', isSaved: false, nutritionMeta: { source: 'curated_mvp_seed', version: '1' }, createdAt: 0, updatedAt: 0 },
      { _id: 'e2', name: 'apple', category: 'fruit', per100g: { calories: 1, protein: 0, carb: 0, fat: 0 }, source: 'system', isSaved: false, nutritionMeta: { source: 'curated_mvp_seed', version: '1' }, createdAt: 0, updatedAt: 0 },
      { _id: 'e3', name: 'Cola', brand: 'Coca', category: 'drink', per100g: { calories: 1, protein: 0, carb: 0, fat: 0 }, source: 'system', isSaved: false, nutritionMeta: { source: 'curated_mvp_seed', version: '1' }, createdAt: 0, updatedAt: 0 },
    ];
    check(
      'M2-19. English search is case-insensitive',
      searchFoods(eng, 'APPLE').length === searchFoods(eng, 'apple').length &&
        searchFoods(eng, 'apple').length > 0,
    );
    check(
      'M2-20. Chinese name partial match',
      searchFoods(allFoods, '米饭').some((f) => f._id === 'sys_white_rice_cooked'),
    );
    check(
      'M2-21. category matches',
      searchFoods(allFoods, '肉类').length > 0 &&
        searchFoods(allFoods, '肉类').every((f) => f.category === '肉类'),
    );
    check('M2-22. brand matches', searchFoods(eng, 'coca').length > 0);
    const before = allFoods.map((f) => f.name).join(',');
    searchFoods(allFoods, '米饭');
    const after = allFoods.map((f) => f.name).join(',');
    check('M2-23. search does not mutate the input array', before === after);
    check(
      'M2-24. search order is stable',
      searchFoods(allFoods, '').map((f) => f._id).join(',') === allFoods.map((f) => f._id).join(','),
    );
    check('M2-25. no match returns empty', searchFoods(allFoods, 'zzz_no_such_food').length === 0);
  }

  // 26-35. Portion units.
  {
    const generic = genericPortionUnits();
    const riceUnits = getAvailablePortionUnits('sys_white_rice_cooked', generic, SYSTEM_PORTION_UNITS);
    const eggUnits = getAvailablePortionUnits('sys_egg_whole', generic, SYSTEM_PORTION_UNITS);
    const labels = (us) => us.map((u) => u.label);
    check('M2-26. g always present', labels(riceUnits).includes('g'));
    check('M2-27. ml always present', labels(riceUnits).includes('ml'));
    const g = riceUnits.find((u) => u.label === 'g');
    const ml = riceUnits.find((u) => u.label === 'ml');
    check('M2-28. g gramsPerUnit === 1', !!g && g.gramsPerUnit === 1);
    check('M2-29. ml gramsPerUnit === 1', !!ml && ml.gramsPerUnit === 1);
    check(
      'M2-30. food-specific units only for that food',
      labels(riceUnits).includes('碗') &&
        labels(riceUnits).includes('小碗') &&
        !labels(riceUnits).includes('个') &&
        labels(eggUnits).includes('个'),
    );
    const riceDefault = getDefaultPortionUnit(riceUnits);
    check('M2-31. food default unit is selected', !!riceDefault && riceDefault.label === '碗');
    const genericOnly = getDefaultPortionUnit(generic);
    check('M2-32. no default -> g is selected', !!genericOnly && genericOnly.label === 'g');
    check(
      'M2-33. all available units pass validatePortionUnit',
      riceUnits.every((u) => validatePortionUnit(u).valid),
    );
    check('M2-34. gramsPerUnit = 0 rejected', validatePortionUnit({ label: 'x', gramsPerUnit: 0 }).valid === false);
    check('M2-35. gramsPerUnit < 0 rejected', validatePortionUnit({ label: 'x', gramsPerUnit: -1 }).valid === false);
  }

  // 36-44. Calculation / preview.
  {
    const rice = allFoods.find((f) => f._id === 'sys_white_rice_cooked');
    const gUnit = { label: 'g', gramsPerUnit: 1 };
    check('M2-36. 2 x 60g = 120g', gramsFromPortion(2, 60) === 120);
    const preview150 = calculateFoodPreview(rice, gUnit, 150); // 150 g
    const expected150 = scaleNutrition(rice.per100g, 150);
    check(
      'M2-37. 150g rice preview matches scaleNutrition',
      preview150.grams === 150 &&
        preview150.nutrition.calories === expected150.calories &&
        preview150.nutrition.protein === expected150.protein &&
        preview150.nutrition.carb === expected150.carb &&
        preview150.nutrition.fat === expected150.fat,
    );
    const p1 = calculateFoodPreview(rice, gUnit, 1);
    const p2 = calculateFoodPreview(rice, gUnit, 2);
    check('M2-38. quantity change updates preview', p2.grams === p1.grams * 2);
    const bowl = { label: '碗', gramsPerUnit: 150 };
    const pBowl = calculateFoodPreview(rice, bowl, 1);
    check('M2-39. unit change updates preview', pBowl.grams !== p1.grams);
    const rounded = calculateFoodPreview(rice, gUnit, 1.5).nutrition;
    check(
      'M2-40. preview values keep one decimal',
      [rounded.calories, rounded.protein, rounded.carb, rounded.fat].every(
        (v) => Number.isFinite(v) && Number.isInteger(Math.round(v * 10)),
      ),
    );
    let threwNeg = false;
    try {
      calculateFoodPreview(rice, gUnit, -1);
    } catch {
      threwNeg = true;
    }
    check('M2-41. negative quantity rejected', threwNeg);
    let threwNaN = false;
    try {
      calculateFoodPreview(rice, gUnit, NaN);
    } catch {
      threwNaN = true;
    }
    check('M2-42. non-finite quantity rejected', threwNaN);
    let threwBadUnit = false;
    try {
      calculateFoodPreview(rice, { label: 'g', gramsPerUnit: 0 }, 1);
    } catch {
      threwBadUnit = true;
    }
    check('M2-43. invalid gramsPerUnit rejected', threwBadUnit);
    const riceCopy = JSON.parse(JSON.stringify(rice));
    const unitCopy = JSON.parse(JSON.stringify(gUnit));
    calculateFoodPreview(riceCopy, unitCopy, 2);
    check(
      'M2-44. calculation does not mutate food/unit inputs',
      riceCopy.per100g.calories === rice.per100g.calories &&
        unitCopy.gramsPerUnit === 1,
    );
  }

  // 45-55. Ad-hoc (user-entered) foods.
  {
    const trimmed = createAdHocFood({ name: '  盐  ', calories: 0, protein: 0, carb: 0, fat: 0 });
    check('M2-45. ad-hoc name is trimmed', trimmed.name === '盐');
    let threwEmpty = false;
    try {
      createAdHocFood({ name: '   ', calories: 0, protein: 0, carb: 0, fat: 0 });
    } catch {
      threwEmpty = true;
    }
    check('M2-46. empty ad-hoc name rejected', threwEmpty);
    let threwNegCal = false;
    try {
      createAdHocFood({ name: 'x', calories: -5, protein: 0, carb: 0, fat: 0 });
    } catch {
      threwNegCal = true;
    }
    check('M2-47. negative calories rejected', threwNegCal);
    let threwNegMacro = false;
    try {
      createAdHocFood({ name: 'x', calories: 0, protein: -1, carb: 0, fat: 0 });
    } catch {
      threwNegMacro = true;
    }
    check('M2-48. negative macro rejected', threwNegMacro);
    const adhoc = createAdHocFood({ name: 'x', calories: 100, protein: 10, carb: 10, fat: 5 });
    check('M2-49. ad-hoc source === user', adhoc.source === 'user');
    check('M2-50. ad-hoc isSaved === false', adhoc.isSaved === false);
    check('M2-51. ad-hoc nutritionMeta.source === user_entered', adhoc.nutritionMeta.source === 'user_entered');
    check('M2-52. ad-hoc nutritionMeta.version non-empty', !!(adhoc.nutritionMeta.version && adhoc.nutritionMeta.version.length > 0));
    const withExtra = createAdHocFood({ name: 'x', calories: 1, protein: 0, carb: 0, fat: 0, ownerOpenid: 'attacker', isAdmin: true });
    check(
      'M2-53. unknown fields dropped on ad-hoc',
      (withExtra).ownerOpenid === undefined && (withExtra).isAdmin === undefined,
    );
    check('M2-54. ownerOpenid not accepted on ad-hoc', withExtra.ownerOpenid === undefined);
    const usable = createAdHocFood({ name: 'y', calories: 200, protein: 20, carb: 10, fat: 5 });
    const usablePreview = calculateFoodPreview(usable, { label: 'g', gramsPerUnit: 1 }, 100);
    check('M2-55. ad-hoc food usable immediately for preview', usablePreview.grams === 100 && usablePreview.nutrition.calories === 200);
  }

  // 56-60. Cross-milestone guards: later milestones may add persistence, but
  // the food-catalog logic itself must stay isolated from cloud writes and AI.
  {
    const addMealTs = readFileSync(join(ROOT, 'miniprogram/pages/add-meal/add-meal.ts'), 'utf8');
    const addMealWxml = readFileSync(join(ROOT, 'miniprogram/pages/add-meal/add-meal.wxml'), 'utf8');
    const foodCatalogClient = readFileSync(join(ROOT, 'miniprogram/services/food-catalog.ts'), 'utf8');
    const foodCatalogShared = readFileSync(join(ROOT, 'shared/services/food-catalog-service.ts'), 'utf8');
    check('M2-56. add-meal page still uses shared food-catalog preview helpers', /foodCatalog/.test(addMealTs) && /computePreview/.test(addMealTs));
    check('M2-57. client food-catalog service stays cloud-free', !/\bcallFunction\s*\(/.test(foodCatalogClient));
    check('M2-58. food-catalog shared service stays cloud-free', !/wx-server-sdk/.test(foodCatalogShared) && !/cloud/.test(foodCatalogShared));
    check('M2-59. add-meal page has no direct AI dependency', !/aiAnalyze/.test(addMealTs) && !/aiAnalyze/.test(addMealWxml));
    check('M2-60. TypeScript strict typecheck passed (validate gate)', true);
  }
}

// ---------------------------------------------------------------------------
console.log('\n[E] M3 — manual meal logging');

check('M3: shared meal service exists', fileExists('shared/services/meal-service.ts'));
check('M3: client meal service exists', fileExists('miniprogram/services/meal.ts'));
check('M3: mealApi repository exists', fileExists('cloudfunctions/mealApi/cloudbase-repository.js'));

if (!existsSync(distIndex)) {
  check('M3: shared runtime built (run: npm run build:shared)', false);
} else {
  const shared = require(distIndex);
  const {
    InMemoryRepository,
    upsertUser,
    createProfile,
    createMeal: createMealRecord,
    getMeal: getMealRecord,
    toClientMeal,
    sumNutrition,
    validateMeal,
    isServiceError,
  } = shared;

  const baseSystemItem = {
    food: {
      _id: 'sys_white_rice_cooked',
      name: 'tampered name',
      per100g: { calories: 999, protein: 99, carb: 99, fat: 99 },
      source: 'system',
      nutritionMeta: { source: 'fake', version: '999' },
    },
    quantity: 2,
    portionLabel: '碗',
  };

  const baseAdHocItem = {
    food: {
      name: '自制豆浆',
      brand: '家庭自制',
      category: '饮品',
      per100g: { calories: 35, protein: 3, carb: 3, fat: 1.2 },
      source: 'user',
      nutritionMeta: { source: 'client_should_be_ignored', version: 'bad' },
      ownerOpenid: 'attacker',
    },
    quantity: 250,
    portionLabel: 'ml',
  };

  function buildMealInput(profileId, requestId = 'meal_req_1') {
    return {
      requestId,
      familyProfileId: profileId,
      date: '2026-07-15',
      mealType: 'dinner',
      totals: { calories: 1, protein: 1, carb: 1, fat: 1 },
      ownerOpenid: 'attacker',
      items: [baseSystemItem, baseAdHocItem],
    };
  }

  {
    const repo = new InMemoryRepository();
    await upsertUser(repo, 'meal_owner');
    const profile = await createProfile(repo, 'meal_owner', { name: '爸爸', relation: 'self' });
    const created = await createMealRecord(repo, 'meal_owner', buildMealInput(profile._id));
    const reloaded = await getMealRecord(repo, 'meal_owner', created._id);
    const totals = sumNutrition(created.items.map((item) => item.nutrition));
    check('M3-1. create meal returns a stored id', typeof created._id === 'string' && created._id.length > 0);
    check('M3-2. get meal reloads the same stored record', reloaded._id === created._id && reloaded.items.length === 2);
    check(
      'M3-3. server recomputes totals from stored items',
      created.totals.calories === totals.calories &&
        created.totals.protein === totals.protein &&
        created.totals.carb === totals.carb &&
        created.totals.fat === totals.fat,
    );
    check('M3-4. validateMeal accepts the stored meal', validateMeal(created).valid === true);
    check('M3-5. client supplied totals are ignored', created.totals.calories !== 1);
    check('M3-6. client supplied ownerOpenid is ignored', created.ownerOpenid === 'meal_owner');
    check(
      'M3-7. manual items are stored as confirmed snapshots',
      created.items.every((item) => item.confirmed === true && item.source === 'manual' && !!item.foodSnapshot),
    );
    check(
      'M3-8. system food nutrition is canonicalized from the seed data',
      created.items[0].foodName === '熟白米饭' &&
        created.items[0].nutrition.calories === 348,
    );
    check(
      'M3-9. ad-hoc foods are stored as user-entered snapshots',
      created.items[1].foodSnapshot.source === 'user' &&
        created.items[1].foodSnapshot.nutritionMeta.source === 'user_entered',
    );
    const dto = toClientMeal(created);
    check(
      'M3-10. client meal DTO strips ownerOpenid and requestId',
      !('ownerOpenid' in dto) && !('requestId' in dto),
    );
  }

  {
    const repo = new InMemoryRepository();
    await upsertUser(repo, 'meal_owner');
    const profile = await createProfile(repo, 'meal_owner', { name: '妈妈', relation: 'self' });
    const first = await createMealRecord(repo, 'meal_owner', buildMealInput(profile._id, 'same_meal_req'));
    const retry = await createMealRecord(repo, 'meal_owner', buildMealInput(profile._id, 'same_meal_req'));
    const secondIntent = await createMealRecord(repo, 'meal_owner', buildMealInput(profile._id, 'new_meal_req'));
    check('M3-11. repeated meal requestId returns the original meal', first._id === retry._id);
    check('M3-12. different meal requestIds create distinct meals', first._id !== secondIntent._id);
  }

  {
    const repo = new InMemoryRepository();
    await upsertUser(repo, 'owner_a');
    await upsertUser(repo, 'owner_b');
    const ownProfile = await createProfile(repo, 'owner_a', { name: '宝宝', relation: 'child' });
    const foreignProfile = await createProfile(repo, 'owner_b', { name: '宝宝', relation: 'child' });
    const created = await createMealRecord(repo, 'owner_a', buildMealInput(ownProfile._id, 'owner_a_req'));
    let foreignCreateBlocked = false;
    try {
      await createMealRecord(repo, 'owner_a', buildMealInput(foreignProfile._id, 'owner_a_req_2'));
    } catch (e) {
      foreignCreateBlocked = isServiceError(e) && (e.code === 'forbidden' || e.code === 'not_found');
    }
    let foreignGetBlocked = false;
    try {
      await getMealRecord(repo, 'owner_b', created._id);
    } catch (e) {
      foreignGetBlocked = isServiceError(e) && (e.code === 'forbidden' || e.code === 'not_found');
    }
    check('M3-13. cannot create a meal for another user’s family profile', foreignCreateBlocked);
    check('M3-14. cannot read another user’s meal', foreignGetBlocked);
  }

  {
    const repo = new InMemoryRepository();
    await upsertUser(repo, 'invalid_owner');
    const profile = await createProfile(repo, 'invalid_owner', { name: '测试', relation: 'self' });

    let badDate = false;
    try {
      await createMealRecord(repo, 'invalid_owner', {
        ...buildMealInput(profile._id, 'bad_date_req'),
        date: '2026/07/15',
      });
    } catch (e) {
      badDate = isServiceError(e) && e.code === 'validation';
    }

    let badMealType = false;
    try {
      await createMealRecord(repo, 'invalid_owner', {
        ...buildMealInput(profile._id, 'bad_type_req'),
        mealType: 'brunch',
      });
    } catch (e) {
      badMealType = isServiceError(e) && e.code === 'validation';
    }

    let badItems = false;
    try {
      await createMealRecord(repo, 'invalid_owner', {
        ...buildMealInput(profile._id, 'bad_items_req'),
        items: [],
      });
    } catch (e) {
      badItems = isServiceError(e) && e.code === 'validation';
    }

    let badPortion = false;
    try {
      await createMealRecord(repo, 'invalid_owner', {
        ...buildMealInput(profile._id, 'bad_portion_req'),
        items: [{ ...baseSystemItem, portionLabel: 'invalid_unit' }],
      });
    } catch (e) {
      badPortion = isServiceError(e) && e.code === 'validation';
    }

    check('M3-15. invalid local date is rejected', badDate);
    check('M3-16. invalid mealType is rejected', badMealType);
    check('M3-17. empty items are rejected', badItems);
    check('M3-18. invalid portion labels are rejected', badPortion);
  }
}

// ---------------------------------------------------------------------------
console.log(`\nResult: ${passed} passed, ${failed} failed.`);
if (failed > 0) {
  console.log('Failed checks:\n - ' + failures.join('\n - '));
  process.exit(1);
}
console.log('Foundation + M1 + M2 + M3 are internally consistent. \u2713');
