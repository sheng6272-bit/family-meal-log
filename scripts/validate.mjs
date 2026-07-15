#!/usr/bin/env node
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST_INDEX = join(ROOT, 'shared/dist/index.js');

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

function readText(rel) {
  return readFileSync(join(ROOT, rel), 'utf8');
}

function readJson(rel) {
  return JSON.parse(readText(rel));
}

function isGitIgnored(rel) {
  return spawnSync('git', ['check-ignore', '-q', rel], { cwd: ROOT }).status === 0;
}

function throws(fn, pattern) {
  try {
    fn();
    return false;
  } catch (error) {
    return pattern ? pattern.test(String(error.message || error)) : true;
  }
}

async function rejects(fn, pattern) {
  try {
    await fn();
    return false;
  } catch (error) {
    return pattern ? pattern.test(String(error.message || error)) : true;
  }
}

console.log('\n[A] Structural checks');

const requiredFiles = [
  'README.md',
  '.gitignore',
  '.env.example',
  'package.json',
  'tsconfig.json',
  'project.config.json',
  'docs/ARCHITECTURE.md',
  'docs/CODEX_HANDOFF.md',
  'docs/DATA_MODEL.md',
  'docs/DEVELOPMENT_PLAN.md',
  'docs/FINAL_HUMAN_RUNBOOK.md',
  'docs/MANUAL_TEST_CHECKLIST.md',
  'docs/PRODUCT_REQUIREMENTS.md',
  'docs/SECURITY.md',
  'docs/USER_FLOWS.md',
  'miniprogram/app.json',
  'miniprogram/app.ts',
  'shared/index.ts',
  'shared/nutrition.ts',
  'shared/validation.ts',
  'shared/services/meal-service.ts',
  'shared/services/food-library-service.ts',
  'shared/services/recipe-service.ts',
  'shared/services/ai-analysis-service.ts',
];
for (const rel of requiredFiles) check(`exists: ${rel}`, fileExists(rel));

const appJson = readJson('miniprogram/app.json');
check('app.json declares pages', Array.isArray(appJson.pages) && appJson.pages.length >= 5);
for (const page of appJson.pages) {
  for (const ext of ['ts', 'json', 'wxml', 'wxss']) {
    check(`page file: miniprogram/${page}.${ext}`, fileExists(`miniprogram/${page}.${ext}`));
  }
}

for (const fn of ['login', 'profileApi', 'mealApi', 'aiAnalyze']) {
  for (const rel of ['index.js', 'package.json', 'config.json']) {
    check(`cloudfn: cloudfunctions/${fn}/${rel}`, fileExists(`cloudfunctions/${fn}/${rel}`));
  }
}

const envTs = readText('miniprogram/config/env.ts');
const appTs = readText('miniprogram/app.ts');
check(
  'env.ts contains no committed cloudEnvId',
  !/cloudEnvId:\s*['"][^'"]+['"]/.test(envTs) || /cloudEnvId:\s*['"]{2}/.test(envTs),
);
check('app.ts does not hard-import env.local.ts', !/from ['"]\.\/config\/env\.local['"]/.test(appTs));
check(
  '.gitignore protects env and generated outputs',
  /\.env/.test(readText('.gitignore')) &&
    readText('.gitignore').includes('project.private.config.json') &&
    readText('.gitignore').includes('miniprogram/lib/shared/') &&
    readText('.gitignore').includes('cloudfunctions/*/lib/shared/'),
);
check('generated mini program shared runtime is git-ignored', isGitIgnored('miniprogram/lib/shared/index.js'));
for (const fn of ['login', 'profileApi', 'mealApi', 'aiAnalyze']) {
  check(`generated cloud runtime: ${fn}`, fileExists(`cloudfunctions/${fn}/lib/shared/index.js`));
  check(`generated cloud runtime ignored: ${fn}`, isGitIgnored(`cloudfunctions/${fn}/lib/shared/index.js`));
}
check('login cloud function uses shared runtime', /lib\/shared/.test(readText('cloudfunctions/login/index.js')));
check('profileApi cloud function uses shared runtime', /lib\/shared/.test(readText('cloudfunctions/profileApi/index.js')));

const sharedBuilt = existsSync(DIST_INDEX);
check('shared runtime built', sharedBuilt);

let shared = null;
if (sharedBuilt) {
  shared = require(DIST_INDEX);
}

console.log('\n[B] Shared baseline');

if (!shared) {
  check('shared runtime available for logic checks', false);
} else {
  const {
    buildSampleMeal,
    caloriesFromMacros,
    createAdHocFood,
    gramsFromPortion,
    isCalorieMacroConsistent,
    scaleNutrition,
    sumNutrition,
    validateAiAnalysis,
    validateFood,
    validateMeal,
    validateRecipe,
  } = shared;

  check('gramsFromPortion(2, 60) === 120', gramsFromPortion(2, 60) === 120);
  check('scaleNutrition 150g keeps expected calories', scaleNutrition({ calories: 130, protein: 2.7, carb: 28, fat: 0.3 }, 150).calories === 195);
  check('sumNutrition totals lists correctly', sumNutrition([{ calories: 100, protein: 5, carb: 10, fat: 2 }, { calories: 50, protein: 1, carb: 8, fat: 1 }]).calories === 150);
  check('macro calorie helper stays consistent', caloriesFromMacros(10, 20, 5) === 165 && isCalorieMacroConsistent({ calories: 165, protein: 31, carb: 0, fat: 3.6 }));
  const sampleMeal = buildSampleMeal();
  check('sample meal totals match recomputed items', JSON.stringify(sumNutrition(sampleMeal.items.map((item) => item.nutrition))) === JSON.stringify(sampleMeal.totals));
  check('sample meal validates', validateMeal(buildSampleMeal()).valid === true);
  check('bad meal shape is rejected', validateMeal({ items: 'nope' }).valid === false);
  check('bad food is rejected', validateFood({ name: 'bad', per100g: { calories: -1, protein: 0, carb: 0, fat: 0 }, source: 'system', isSaved: false, nutritionMeta: { source: 'x', version: '1' } }).valid === false);
  check('ad-hoc foods are created as user foods', createAdHocFood({ name: 'Temp', calories: 10, protein: 1, carb: 1, fat: 1 }).source === 'user');
  check('gramsFromPortion rejects gramsPerUnit <= 0', throws(() => gramsFromPortion(1, 0)));
  check('empty recipe shape is rejected', validateRecipe({}).valid === false);
  check('empty ai analysis shape is rejected', validateAiAnalysis({}).valid === false);
}

console.log('\n[C] M1 — identity and family profiles');

if (!shared) {
  check('M1 shared runtime available', false);
} else {
  const {
    InMemoryRepository,
    createProfile,
    getProfile,
    listProfiles,
    resolveActiveProfile,
    setDefaultProfile,
    toClientProfile,
    updateProfile,
    upsertUser,
    isServiceError,
  } = shared;

  {
    const repo = new InMemoryRepository();
    const first = await upsertUser(repo, 'u1');
    const second = await upsertUser(repo, 'u1');
    check('M1-1. login upsert is idempotent', first.isNew === true && second.isNew === false);

    const profileA = await createProfile(repo, 'u1', { name: 'Owner', relation: 'self' }, 'req-a');
    const profileB = await createProfile(repo, 'u1', { name: 'Kid', relation: 'child' }, 'req-b');
    const profiles = await listProfiles(repo, 'u1');
    const user = await repo.findUserByOpenid('u1');
    check('M1-2. first profile becomes default', user.defaultFamilyProfileId === profileA._id);
    check('M1-3. repeated requestId returns the same profile', (await createProfile(repo, 'u1', { name: 'Owner', relation: 'self' }, 'req-a'))._id === profileA._id);
    check('M1-4. profiles list is owner-scoped', profiles.length === 2);
    check('M1-5. default flag is computed in DTO only', toClientProfile(profileA, user.defaultFamilyProfileId).isDefault === true && !('isDefault' in (await getProfile(repo, 'u1', profileA._id))));
    const trimmed = await createProfile(repo, 'u1', { name: '  Trim Me  ', relation: 'other', ownerOpenid: 'attacker', isAdmin: true }, 'req-c');
    check('M1-5b. unknown fields are stripped and owner stays server-derived', trimmed.ownerOpenid === 'u1' && trimmed.name === 'Trim Me' && trimmed.isAdmin === undefined);

    await setDefaultProfile(repo, 'u1', profileB._id);
    const updatedUser = await repo.findUserByOpenid('u1');
    check('M1-6. changing default updates the user record', updatedUser.defaultFamilyProfileId === profileB._id);
    check('M1-7. stale local active profile falls back safely', resolveActiveProfile(profiles, 'stale', profileB._id)._id === profileB._id);

    await upsertUser(repo, 'u2');
    let blocked = false;
    try {
      await updateProfile(repo, 'u2', profileA._id, { name: 'Hack', relation: 'other' });
    } catch (e) {
      blocked = isServiceError(e) && (e.code === 'forbidden' || e.code === 'not_found');
    }
    check('M1-8. cross-owner profile updates are blocked', blocked);
    check('M1-9. empty profile names are rejected', await rejects(() => createProfile(repo, 'u1', { name: '   ', relation: 'self' }, 'req-empty')));
    check('M1-10. invalid relations are rejected', await rejects(() => createProfile(repo, 'u1', { name: 'Nope', relation: 'robot' }, 'req-bad')));
    check('M1-11. requestId replay is owner-scoped', (await createProfile(repo, 'u2', { name: 'Other Owner', relation: 'self' }, 'req-a'))._id !== profileA._id);
    check('M1-12. cross-owner default changes are blocked', await rejects(() => setDefaultProfile(repo, 'u2', profileA._id)));
  }
}

{
  const authSrc = readText('miniprogram/services/auth.ts');
  check('M1-13. client auth service does not expose openid', !/\bopenid\s*:/.test(authSrc) && !/res\.user\.openid/.test(authSrc));
  check('M1-14. app globalData does not store openid', !/globalData:\s*\{[\s\S]*openid\s*:/.test(appTs) && !/this\.globalData\.openid\s*=/.test(appTs));
  check('M1-15. login cloud function returns no openid', !/openid:\s*/.test(readText('cloudfunctions/login/index.js')));
}

console.log('\n[D] M2 — food catalog and portion units');

if (!shared) {
  check('M2 shared runtime available', false);
} else {
  const {
    SYSTEM_FOODS,
    SYSTEM_PORTION_UNITS,
    calculateFoodPreview,
    createAdHocFood,
    genericPortionUnits,
    getAvailablePortionUnits,
    getDefaultPortionUnit,
    searchFoods,
    validateFood,
    validatePortionUnit,
  } = shared;
  const foodCatalogClient = readText('miniprogram/services/food-catalog.ts');
  const addMealTs = readText('miniprogram/pages/add-meal/add-meal.ts');

  const rice = SYSTEM_FOODS.find((food) => food._id === 'sys_white_rice_cooked');
  check('M2-1. seed dataset has at least 8 foods', SYSTEM_FOODS.length >= 8);
  check('M2-2. seed foods validate cleanly', SYSTEM_FOODS.every((food) => validateFood(food).valid));
  check('M2-2b. seed food ids are unique', new Set(SYSTEM_FOODS.map((food) => food._id)).size === SYSTEM_FOODS.length);
  check('M2-2c. seed foods do not carry ownerOpenid', SYSTEM_FOODS.every((food) => !food.ownerOpenid));
  check('M2-3. search is trim/case safe', searchFoods(SYSTEM_FOODS, '  rice  ').length === searchFoods(SYSTEM_FOODS, 'rice').length);
  check('M2-4. chinese seed search works', searchFoods(SYSTEM_FOODS, '米饭').some((food) => food._id === 'sys_white_rice_cooked'));
  check('M2-4b. search keeps input order stable', searchFoods(SYSTEM_FOODS, '').map((food) => food._id).join(',') === SYSTEM_FOODS.map((food) => food._id).join(','));
  check('M2-4c. search does not mutate the input list', (() => { const ids = SYSTEM_FOODS.map((food) => food._id).join(','); searchFoods(SYSTEM_FOODS, 'rice'); return SYSTEM_FOODS.map((food) => food._id).join(',') === ids; })());
  check('M2-5. available portion units include g and ml', ['g', 'ml'].every((label) => getAvailablePortionUnits('sys_white_rice_cooked', genericPortionUnits(), SYSTEM_PORTION_UNITS).some((unit) => unit.label === label)));
  check('M2-6. default portion unit resolves', !!getDefaultPortionUnit(getAvailablePortionUnits('sys_white_rice_cooked', genericPortionUnits(), SYSTEM_PORTION_UNITS)));
  check('M2-7. preview calculation is deterministic', calculateFoodPreview(rice, { label: 'g', gramsPerUnit: 1 }, 150).nutrition.calories === 174);
  check('M2-7b. invalid preview quantities are rejected', throws(() => calculateFoodPreview(rice, { label: 'g', gramsPerUnit: 1 }, -1)));
  check('M2-8. ad-hoc foods validate immediately', createAdHocFood({ name: 'Custom', calories: 100, protein: 5, carb: 10, fat: 3 }).source === 'user');
  check('M2-8b. ad-hoc food names are trimmed', createAdHocFood({ name: '  Salt  ', calories: 0, protein: 0, carb: 0, fat: 0 }).name === 'Salt');
  check('M2-8c. ad-hoc foods strip unknown fields', createAdHocFood({ name: 'x', calories: 1, protein: 0, carb: 0, fat: 0, ownerOpenid: 'attacker', isAdmin: true }).ownerOpenid === undefined);
  check('M2-8d. ad-hoc foods mark user_entered provenance', createAdHocFood({ name: 'Trace', calories: 1, protein: 0, carb: 0, fat: 0 }).nutritionMeta.source === 'user_entered');
  check('M2-9. invalid portion units are rejected', validatePortionUnit({ label: 'bad', gramsPerUnit: 0 }).valid === false);
  check('M2-10. client food catalog stays cloud-free', !/\bcallFunction\s*\(/.test(foodCatalogClient));
  check('M2-11. add-meal page uses shared preview helpers', /computePreview/.test(addMealTs));
}

console.log('\n[E] M3 — manual meal logging');

{
  const mealRepoSrc = readText('cloudfunctions/mealApi/cloudbase-repository.js');
  check('M3-1. meal repository handles duplicate-key replay', /isDuplicateKeyError/.test(mealRepoSrc) && /mealsCol\.add/.test(mealRepoSrc));
  check('M3-2. meal create no longer depends on lookup-before-insert', !/const existing = await mealsCol/.test(mealRepoSrc));
}

if (!shared) {
  check('M3 shared runtime available', false);
} else {
  const {
    InMemoryRepository,
    createMeal,
    createProfile,
    getMeal,
    toClientMeal,
    upsertUser,
    validateMeal,
    isServiceError,
  } = shared;

  function systemItem(foodId, quantity, portionLabel = 'g', source = 'manual') {
    return {
      food: {
        _id: foodId,
        name: 'tampered',
        per100g: { calories: 999, protein: 99, carb: 99, fat: 99 },
        source: 'system',
        nutritionMeta: { source: 'tampered', version: '999' },
      },
      quantity,
      portionLabel,
      source,
    };
  }

  {
    const repo = new InMemoryRepository();
    await upsertUser(repo, 'meal_owner');
    const profile = await createProfile(repo, 'meal_owner', { name: 'Owner', relation: 'self' });
    const meal = await createMeal(repo, 'meal_owner', {
      requestId: 'meal_req',
      familyProfileId: profile._id,
      date: '2026-07-15',
      mealType: 'dinner',
      totals: { calories: 1, protein: 1, carb: 1, fat: 1 },
      ownerOpenid: 'attacker',
      items: [
        systemItem('sys_white_rice_cooked', 150),
        {
          food: {
            name: 'Custom Soup',
            category: 'Soup',
            per100g: { calories: 35, protein: 3, carb: 3, fat: 1.2 },
            source: 'user',
            nutritionMeta: { source: 'bad', version: 'bad' },
          },
          quantity: 250,
          portionLabel: 'ml',
        },
      ],
    });
    const replay = await createMeal(repo, 'meal_owner', {
      requestId: 'meal_req',
      familyProfileId: profile._id,
      date: '2026-07-15',
      mealType: 'dinner',
      items: [systemItem('sys_white_rice_cooked', 150)],
    });
    const fresh = await createMeal(repo, 'meal_owner', {
      requestId: 'meal_req_2',
      familyProfileId: profile._id,
      date: '2026-07-15',
      mealType: 'dinner',
      items: [systemItem('sys_white_rice_cooked', 150)],
    });
    check('M3-3. created meals validate cleanly', validateMeal(meal).valid === true);
    check('M3-4. server ignores client owner and totals', meal.ownerOpenid === 'meal_owner' && meal.totals.calories !== 1);
    check('M3-5. system food snapshots are canonicalized', meal.items[0].foodSnapshot.foodId === 'sys_white_rice_cooked' && meal.items[0].nutrition.calories === 174);
    check('M3-6. repeated requestId replays the original meal', replay._id === meal._id);
    check('M3-7. new requestId creates a new meal', fresh._id !== meal._id);
    check('M3-8. getMeal reloads the stored meal', (await getMeal(repo, 'meal_owner', meal._id))._id === meal._id);
    check('M3-8b. client meal DTO strips ownerOpenid and requestId', !('ownerOpenid' in toClientMeal(meal)) && !('requestId' in toClientMeal(meal)));

    await upsertUser(repo, 'stranger');
    let blocked = false;
    try {
      await getMeal(repo, 'stranger', meal._id);
    } catch (e) {
      blocked = isServiceError(e) && (e.code === 'forbidden' || e.code === 'not_found');
    }
    check('M3-9. cross-owner meal reads are blocked', blocked);
    check('M3-10. cannot create meals for another owner profile', await rejects(() => createMeal(repo, 'stranger', { requestId: 'forbidden', familyProfileId: profile._id, date: '2026-07-15', mealType: 'dinner', items: [systemItem('sys_white_rice_cooked', 100)] })));
    check('M3-11. invalid local dates are rejected', await rejects(() => createMeal(repo, 'meal_owner', { requestId: 'bad_date', familyProfileId: profile._id, date: '2026/07/15', mealType: 'dinner', items: [systemItem('sys_white_rice_cooked', 100)] })));
    check('M3-12. invalid meal types are rejected', await rejects(() => createMeal(repo, 'meal_owner', { requestId: 'bad_type', familyProfileId: profile._id, date: '2026-07-15', mealType: 'brunch', items: [systemItem('sys_white_rice_cooked', 100)] })));
    check('M3-13. empty items are rejected', await rejects(() => createMeal(repo, 'meal_owner', { requestId: 'bad_items', familyProfileId: profile._id, date: '2026-07-15', mealType: 'dinner', items: [] })));
    check('M3-14. invalid portion labels are rejected', await rejects(() => createMeal(repo, 'meal_owner', { requestId: 'bad_portion', familyProfileId: profile._id, date: '2026-07-15', mealType: 'dinner', items: [systemItem('sys_white_rice_cooked', 100, 'invalid_unit')] })));
  }
}

console.log('\n[F] M4 — daily history, edit, and delete');

{
  const homeTs = readText('miniprogram/pages/home/home.ts');
  check('M4-1. home page loads daily history', /mealApi\.listMeals/.test(homeTs));
  check('M4-2. home page supports delete flow', /mealApi\.deleteMeal/.test(homeTs));
  check('M4-3. home page opens the add-meal editor with a mealId', /mealId=\$\{mealId\}/.test(homeTs));
}

if (!shared) {
  check('M4 shared runtime available', false);
} else {
  const {
    InMemoryRepository,
    createMeal,
    createProfile,
    deleteMeal,
    listMeals,
    updateMeal,
    upsertUser,
    isServiceError,
    sumNutrition,
  } = shared;

  function systemItem(foodId, quantity) {
    return { food: { _id: foodId }, quantity, portionLabel: 'g' };
  }

  {
    const repo = new InMemoryRepository();
    await upsertUser(repo, 'm4_owner');
    const profileA = await createProfile(repo, 'm4_owner', { name: 'Owner', relation: 'self' });
    const profileB = await createProfile(repo, 'm4_owner', { name: 'Kid', relation: 'child' });

    const meal1 = await createMeal(repo, 'm4_owner', { requestId: 'm4_a', familyProfileId: profileA._id, date: '2026-07-15', mealType: 'breakfast', items: [systemItem('sys_white_rice_cooked', 150)] });
    const meal2 = await createMeal(repo, 'm4_owner', { requestId: 'm4_b', familyProfileId: profileA._id, date: '2026-07-15', mealType: 'lunch', items: [systemItem('sys_broccoli_cooked', 80)] });
    await createMeal(repo, 'm4_owner', { requestId: 'm4_c', familyProfileId: profileA._id, date: '2026-07-16', mealType: 'dinner', items: [systemItem('sys_chicken_breast_cooked', 120)] });
    await createMeal(repo, 'm4_owner', { requestId: 'm4_d', familyProfileId: profileB._id, date: '2026-07-15', mealType: 'snack', items: [systemItem('sys_egg_whole', 50)] });

    const day15 = await listMeals(repo, 'm4_owner', profileA._id, '2026-07-15');
    check('M4-4. listMeals filters by owner/profile/date', day15.meals.length === 2);
    check('M4-5. listMeals returns per-day totals', JSON.stringify(day15.totals) === JSON.stringify(sumNutrition(day15.meals.map((meal) => meal.totals))));

    await updateMeal(repo, 'm4_owner', meal2._id, {
      date: '2026-07-16',
      mealType: 'dinner',
      items: [systemItem('sys_chicken_breast_cooked', 100)],
    });
    check('M4-6. updateMeal moves meals across dates', (await listMeals(repo, 'm4_owner', profileA._id, '2026-07-15')).meals.length === 1 && (await listMeals(repo, 'm4_owner', profileA._id, '2026-07-16')).meals.length === 2);

    await deleteMeal(repo, 'm4_owner', meal1._id);
    check('M4-7. deleteMeal updates daily history', (await listMeals(repo, 'm4_owner', profileA._id, '2026-07-15')).meals.length === 0);

    await upsertUser(repo, 'm4_stranger');
    let blocked = false;
    try {
      await deleteMeal(repo, 'm4_stranger', meal2._id);
    } catch (e) {
      blocked = isServiceError(e) && (e.code === 'forbidden' || e.code === 'not_found');
    }
    check('M4-8. cross-owner deletes are blocked', blocked);
  }
}

console.log('\n[G] M5 — saved foods and recipes');

{
  const libraryTs = readText('miniprogram/pages/library/library.ts');
  check('M5-1. library page calls listLibrary', /libraryApi\.listLibrary/.test(libraryTs));
  check('M5-2. library page supports recipe create/update/delete', /createRecipe/.test(libraryTs) && /updateRecipe/.test(libraryTs) && /deleteRecipe/.test(libraryTs));
}

if (!shared) {
  check('M5 shared runtime available', false);
} else {
  const {
    InMemoryRepository,
    createMeal,
    createProfile,
    createRecipe,
    deleteRecipe,
    getRecipe,
    listRecipes,
    listSavedFoods,
    recipeToFood,
    recipeToPortionUnit,
    removeSavedFood,
    saveFood,
    scaleNutrition,
    sumNutrition,
    upsertUser,
    validateRecipe,
    isServiceError,
    SYSTEM_FOODS,
  } = shared;

  const rice = SYSTEM_FOODS.find((food) => food._id === 'sys_white_rice_cooked');
  const broccoli = SYSTEM_FOODS.find((food) => food._id === 'sys_broccoli_cooked');

  {
    const repo = new InMemoryRepository();
    await upsertUser(repo, 'm5_owner');
    const savedA = await saveFood(repo, 'm5_owner', rice);
    const savedB = await saveFood(repo, 'm5_owner', rice);
    await saveFood(repo, 'm5_owner', {
      name: 'Yogurt',
      category: 'Dairy',
      per100g: { calories: 72, protein: 3.6, carb: 6.2, fat: 3.8 },
      source: 'user',
      isSaved: false,
      nutritionMeta: { source: 'user_entered', version: '1' },
    });
    check('M5-3. duplicate save reuses the same saved food', savedA._id === savedB._id);
    check('M5-4. saved foods list remains owner-scoped', (await listSavedFoods(repo, 'm5_owner')).length === 2 && (await listSavedFoods(repo, 'other')).length === 0);

    const recipeDto = await createRecipe(repo, 'm5_owner', {
      name: 'Rice And Broccoli',
      servings: 2,
      ingredients: [
        { food: rice, grams: 200 },
        { food: broccoli, grams: 100 },
      ],
    });
    const storedRecipe = await getRecipe(repo, 'm5_owner', recipeDto._id);
    const expected = sumNutrition([
      scaleNutrition(rice.per100g, 200),
      scaleNutrition(broccoli.per100g, 100),
    ]);
    check('M5-5. recipe per-serving nutrition is ingredient total divided by servings', storedRecipe.perServing.calories === Math.round((expected.calories / 2) * 10) / 10);
    check('M5-6. stored recipes validate cleanly', validateRecipe(storedRecipe).valid === true);
    check('M5-7. recipes convert into recipe foods and 1份 portion units', recipeToFood(storedRecipe).source === 'recipe' && recipeToPortionUnit(storedRecipe).label === '1份');

    const profile = await createProfile(repo, 'm5_owner', { name: 'Owner', relation: 'self' });
    const meal = await createMeal(repo, 'm5_owner', {
      requestId: 'm5_meal',
      familyProfileId: profile._id,
      date: '2026-07-15',
      mealType: 'dinner',
      items: [{ food: { _id: storedRecipe._id }, quantity: 2, portionLabel: '1份' }],
    });
    check('M5-8. recipe servings can be logged into meals', meal.items[0].foodSnapshot.source === 'recipe' && meal.totals.calories === Math.round(storedRecipe.perServing.calories * 2 * 10) / 10);

    await removeSavedFood(repo, 'm5_owner', savedA._id);
    await deleteRecipe(repo, 'm5_owner', storedRecipe._id);
    check('M5-9. saved foods and recipes can be deleted', (await listSavedFoods(repo, 'm5_owner')).length === 1 && (await listRecipes(repo, 'm5_owner')).length === 0);

    await upsertUser(repo, 'm5_stranger');
    let blocked = false;
    try {
      await removeSavedFood(repo, 'm5_stranger', savedB._id);
    } catch (e) {
      blocked = isServiceError(e) && (e.code === 'forbidden' || e.code === 'not_found');
    }
    check('M5-10. cross-owner saved-food deletes are blocked', blocked);
  }
}

console.log('\n[H] M6 — meal photo upload');

{
  const addMealTs = readText('miniprogram/pages/add-meal/add-meal.ts');
  check('M6-1. add-meal chooses media', /chooseMedia/.test(addMealTs));
  check('M6-2. add-meal uploads to CloudBase storage', /wx\.cloud\.uploadFile/.test(addMealTs));
  check('M6-2b. uploads stay under the meal-photos prefix', /cloudPath:\s*`meal-photos\//.test(addMealTs));
  check('M6-3. save payload includes photoFileId', /photoFileId:\s*this\.data\.photoFileId/.test(addMealTs));
}

if (!shared) {
  check('M6 shared runtime available', false);
} else {
  const {
    InMemoryRepository,
    createMeal,
    createProfile,
    updateMeal,
    upsertUser,
    validateMeal,
  } = shared;

  {
    const repo = new InMemoryRepository();
    await upsertUser(repo, 'm6_owner');
    const profile = await createProfile(repo, 'm6_owner', { name: 'Owner', relation: 'self' });
    const meal = await createMeal(repo, 'm6_owner', {
      requestId: 'm6_photo',
      familyProfileId: profile._id,
      date: '2026-07-15',
      mealType: 'dinner',
      photoFileId: 'cloud://meal-photos/photo-1.jpg',
      items: [{ food: { _id: 'sys_white_rice_cooked' }, quantity: 150, portionLabel: 'g' }],
    });
    check('M6-4. meals persist photoFileId', meal.photoFileId === 'cloud://meal-photos/photo-1.jpg');
    check('M6-5. meals with photos still validate', validateMeal(meal).valid === true);
    check('M6-6. manual save still works without a photo', !(await createMeal(repo, 'm6_owner', { requestId: 'm6_no_photo', familyProfileId: profile._id, date: '2026-07-15', mealType: 'snack', items: [{ food: { _id: 'sys_egg_whole' }, quantity: 60, portionLabel: 'g' }] })).photoFileId);
    check('M6-7. photoFileId can be cleared on update', (await updateMeal(repo, 'm6_owner', meal._id, { photoFileId: '' })).photoFileId === undefined);
    check('M6-8. persisted photo ids are not public URLs', !/^https?:\/\//.test(meal.photoFileId));
  }
}

console.log('\n[I] M7 — AI suggestions (mock)');

{
  const addMealTs = readText('miniprogram/pages/add-meal/add-meal.ts');
  check('M7-1. add-meal uses ai analysis adapter', /analyzeMealPhoto/.test(addMealTs));
  check('M7-2. add-meal keeps AI suggestions separate from saved meal items', /aiSuggestions/.test(addMealTs) && /onAddAiSuggestion/.test(addMealTs));
}

if (!shared) {
  check('M7 shared runtime available', false);
} else {
  const {
    InMemoryRepository,
    analyzeMealPhoto,
    createMeal,
    createProfile,
    getAiAnalysis,
    listMeals,
    upsertUser,
    validateAiAnalysis,
    isServiceError,
  } = shared;

  {
    const repo = new InMemoryRepository();
    await upsertUser(repo, 'm7_owner');
    const profile = await createProfile(repo, 'm7_owner', { name: 'Owner', relation: 'self' });
    const provider = {
      name: 'mock-test',
      async analyze() {
        return {
          provider: 'mock-test',
          status: 'succeeded',
          suggestions: [
            {
              foodName: 'Rice',
              estimatedGrams: 120,
              confidence: 0.88,
              matchedFoodId: 'sys_white_rice_cooked',
            },
          ],
        };
      },
    };

    check('M7-3. AI suggestions do not create meals before confirmation', (await listMeals(repo, 'm7_owner', profile._id, '2026-07-15')).meals.length === 0);
    const analysis = await analyzeMealPhoto(repo, 'm7_owner', { photoFileId: 'cloud://meal-photos/ai-1.jpg', hintMealType: 'lunch' }, provider);
    const stored = await getAiAnalysis(repo, 'm7_owner', analysis.analysisId);
    check('M7-4. AI analyses persist and validate', !!analysis.analysisId && validateAiAnalysis(stored).valid === true);

    const meal = await createMeal(repo, 'm7_owner', {
      requestId: 'm7_confirmed',
      familyProfileId: profile._id,
      date: '2026-07-15',
      mealType: 'lunch',
      aiAnalysisId: analysis.analysisId,
      items: [{ food: { _id: 'sys_white_rice_cooked' }, quantity: 120, portionLabel: 'g', source: 'ai_suggested' }],
    });
    check('M7-5. confirmed AI items produce ai_assisted meals', meal.source === 'ai_assisted' && meal.aiAnalysisId === analysis.analysisId);
    check('M7-6. final nutrition still comes from shared calculations', meal.totals.calories === meal.items[0].nutrition.calories);

    const failed = await analyzeMealPhoto(
      repo,
      'm7_owner',
      { photoFileId: 'cloud://meal-photos/ai-2.jpg', hintMealType: 'dinner' },
      { name: 'broken', async analyze() { throw new Error('upstream unavailable'); } },
    );
    check('M7-7. provider failure degrades to a failed advisory result', failed.status === 'failed' && failed.suggestions.length === 0 && /upstream unavailable/.test(failed.errorMessage));
    check('M7-7b. manual meal entry remains usable after AI failure', (await createMeal(repo, 'm7_owner', { requestId: 'm7_manual_after_fail', familyProfileId: profile._id, date: '2026-07-15', mealType: 'dinner', items: [{ food: { _id: 'sys_egg_whole' }, quantity: 60, portionLabel: 'g' }] })).source === 'manual');

    await upsertUser(repo, 'm7_stranger');
    let blocked = false;
    try {
      await getAiAnalysis(repo, 'm7_stranger', analysis.analysisId);
    } catch (e) {
      blocked = isServiceError(e) && (e.code === 'forbidden' || e.code === 'not_found');
    }
    check('M7-8. AI analyses are owner-scoped', blocked);
  }
}

console.log('\n[J] M8 — real provider behind the neutral interface');

check('M8-1. provider module exists', fileExists('cloudfunctions/aiAnalyze/providers/openai-compatible.js'));
{
  const aiIndexSrc = readText('cloudfunctions/aiAnalyze/index.js');
  const aiAdapterSrc = readText('miniprogram/services/ai/ai-adapter.ts');
  check('M8-2. provider selection is controlled by AI_PROVIDER', /AI_PROVIDER/.test(aiIndexSrc));
  check('M8-3. exact supported provider values are explicit', /disabled/.test(aiIndexSrc) && /mock/.test(aiIndexSrc) && /openai-compatible/.test(aiIndexSrc));
  check('M8-4. client code does not reference AI_API_KEY', !/AI_API_KEY/.test(readText('miniprogram/pages/add-meal/add-meal.ts')) && !/AI_API_KEY/.test(aiAdapterSrc));
  check('M8-4b. client AI adapter does not fake cloud failures with local mock success', !/falling back to mock/i.test(aiAdapterSrc) && !/analyzeWithMock/.test(aiAdapterSrc));
}

{
  const {
    buildVisionMessage,
    createOpenAiCompatibleProvider,
    normalizeTimeout,
    parseProviderResponse,
    sanitizeErrorMessage,
  } = require(join(ROOT, 'cloudfunctions/aiAnalyze/providers/openai-compatible.js'));
  const {
    InMemoryRepository,
    analyzeMealPhoto,
    createMeal,
    createProfile,
    upsertUser,
  } = shared;

  check('M8-5. normalizeTimeout clamps low values upward', normalizeTimeout('999') === 1000);
  check('M8-6. normalizeTimeout clamps high values downward', normalizeTimeout('50000') === 30000);
  check('M8-7. parseProviderResponse accepts raw suggestion JSON', Array.isArray(parseProviderResponse(JSON.stringify({ suggestions: [] })).suggestions));
  check('M8-7b. vision payload uses image_url content', buildVisionMessage({ photoFileId: 'cloud://meal-photos/test.jpg', hintMealType: 'dinner' }, 'https://example.com/temp.jpg').content.some((part) => part.type === 'image_url' && part.image_url.url === 'https://example.com/temp.jpg'));
  check(
    'M8-8. parseProviderResponse accepts OpenAI chat content JSON',
    parseProviderResponse(
      JSON.stringify({
        choices: [{ message: { content: JSON.stringify({ suggestions: [{ foodName: 'x', estimatedGrams: 10, confidence: 0.5 }] }) } }],
      }),
    ).suggestions.length === 1,
  );

  let malformedPayloadRejected = false;
  try {
    parseProviderResponse('not-json');
  } catch (e) {
    malformedPayloadRejected = /non-JSON/.test(String(e.message || e));
  }
  check('M8-9. malformed payloads are rejected', malformedPayloadRejected);

  let capturedBody = '';
  const provider = createOpenAiCompatibleProvider(
    {
      AI_PROVIDER: 'openai-compatible',
      AI_API_URL: 'https://example.com/v1/chat/completions',
      AI_API_KEY: 'test-key',
      AI_MODEL: 'test-model',
      AI_TIMEOUT_MS: '1200',
    },
    {
      resolveImageUrl: async () => 'https://example.com/cloudbase-temp-url.jpg',
      transport: async ({ body }) => {
        capturedBody = body;
        return JSON.stringify({
          choices: [{ message: { content: JSON.stringify({ suggestions: [{ foodName: 'Rice', estimatedGrams: 100, confidence: 0.6 }] }) } }],
        });
      },
    },
  );
  const result = await provider.analyze({ ownerOpenid: 'u', photoFileId: 'cloud://photo.jpg' });
  check('M8-10. provider works with mocked transport', result.status === 'succeeded' && result.suggestions.length === 1);
  const payload = JSON.parse(capturedBody);
  check('M8-10b. provider sends actual image_url content instead of only file id text', Array.isArray(payload.messages?.[0]?.content) && payload.messages[0].content.some((part) => part.type === 'image_url' && part.image_url?.url === 'https://example.com/cloudbase-temp-url.jpg') && !capturedBody.includes('cloud://photo.jpg'));

  let missingConfigRejected = false;
  try {
    const badProvider = createOpenAiCompatibleProvider(
      { AI_PROVIDER: 'openai-compatible', AI_API_URL: '', AI_API_KEY: '', AI_MODEL: '' },
      { resolveImageUrl: async () => 'https://example.com/temp.jpg', transport: async () => '{}' },
    );
    await badProvider.analyze({ ownerOpenid: 'u', photoFileId: 'cloud://photo.jpg' });
  } catch (e) {
    missingConfigRejected = /not fully configured/.test(String(e.message || e));
  }
  check('M8-11. missing config fails safely', missingConfigRejected);
  check('M8-11b. provider error messages redact secrets', !sanitizeErrorMessage(new Error('upstream test-key leaked'), 'test-key').includes('test-key'));

  const auditRepo = new InMemoryRepository();
  await upsertUser(auditRepo, 'm8_owner');
  const auditProfile = await createProfile(auditRepo, 'm8_owner', { name: 'Owner', relation: 'self' });

  const failedTempUrl = await analyzeMealPhoto(
    auditRepo,
    'm8_owner',
    { photoFileId: 'cloud://meal-photos/fail.jpg', hintMealType: 'dinner' },
    createOpenAiCompatibleProvider(
      {
        AI_PROVIDER: 'openai-compatible',
        AI_API_URL: 'https://example.com/v1/chat/completions',
        AI_API_KEY: 'test-key',
        AI_MODEL: 'test-model',
      },
      {
        resolveImageUrl: async () => {
          throw new Error('temporary photo URL could not be resolved');
        },
        transport: async () => '{}',
      },
    ),
  );
  check('M8-12. temporary URL resolution failure falls back safely', failedTempUrl.status === 'failed' && failedTempUrl.suggestions.length === 0 && /photo could not be prepared/i.test(failedTempUrl.errorMessage));

  const failedTimeout = await analyzeMealPhoto(
    auditRepo,
    'm8_owner',
    { photoFileId: 'cloud://meal-photos/timeout.jpg', hintMealType: 'lunch' },
    createOpenAiCompatibleProvider(
      {
        AI_PROVIDER: 'openai-compatible',
        AI_API_URL: 'https://example.com/v1/chat/completions',
        AI_API_KEY: 'test-key',
        AI_MODEL: 'test-model',
      },
      {
        resolveImageUrl: async () => 'https://example.com/temp.jpg',
        transport: async () => {
          throw new Error('provider timeout after 1200ms');
        },
      },
    ),
  );
  check('M8-13. provider timeout still falls back safely', failedTimeout.status === 'failed' && /timed out/i.test(failedTimeout.errorMessage));

  const failedMalformed = await analyzeMealPhoto(
    auditRepo,
    'm8_owner',
    { photoFileId: 'cloud://meal-photos/malformed.jpg', hintMealType: 'lunch' },
    createOpenAiCompatibleProvider(
      {
        AI_PROVIDER: 'openai-compatible',
        AI_API_URL: 'https://example.com/v1/chat/completions',
        AI_API_KEY: 'test-key',
        AI_MODEL: 'test-model',
      },
      {
        resolveImageUrl: async () => 'https://example.com/temp.jpg',
        transport: async () => 'not-json',
      },
    ),
  );
  check('M8-14. malformed responses still fall back safely', failedMalformed.status === 'failed' && /non-json|malformed json/i.test(failedMalformed.errorMessage));

  const failedSecret = await analyzeMealPhoto(
    auditRepo,
    'm8_owner',
    { photoFileId: 'cloud://meal-photos/secret.jpg', hintMealType: 'lunch' },
    createOpenAiCompatibleProvider(
      {
        AI_PROVIDER: 'openai-compatible',
        AI_API_URL: 'https://example.com/v1/chat/completions',
        AI_API_KEY: 'super-secret',
        AI_MODEL: 'test-model',
      },
      {
        resolveImageUrl: async () => 'https://example.com/temp.jpg',
        transport: async () => {
          throw new Error('upstream super-secret failed');
        },
      },
    ),
  );
  check('M8-15. secrets do not appear in returned errors', !/super-secret/.test(failedSecret.errorMessage || ''));
  check('M8-16. manual meal entry remains usable after provider failure', (await createMeal(auditRepo, 'm8_owner', { requestId: 'm8_manual_after_ai_fail', familyProfileId: auditProfile._id, date: '2026-07-15', mealType: 'dinner', items: [{ food: { _id: 'sys_egg_whole' }, quantity: 60, portionLabel: 'g' }] })).source === 'manual');
  check('M8-17. unsupported AI_PROVIDER values fail without paid routing', /Unsupported AI_PROVIDER value/.test(readText('cloudfunctions/aiAnalyze/index.js')));
  check('M8-18. final runbook documents exact real-provider value', /AI_PROVIDER=openai-compatible/.test(readText('docs/FINAL_HUMAN_RUNBOOK.md')));
}

console.log(`\nResult: ${passed} passed, ${failed} failed.`);
if (failed > 0) {
  console.log('Failed checks:\n - ' + failures.join('\n - '));
  process.exit(1);
}
console.log('Foundation + M1 through M8 are internally consistent. \u2713');
