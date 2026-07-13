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
console.log(`\nResult: ${passed} passed, ${failed} failed.`);
if (failed > 0) {
  console.log('Failed checks:\n - ' + failures.join('\n - '));
  process.exit(1);
}
console.log('Foundation is internally consistent. \u2713');
