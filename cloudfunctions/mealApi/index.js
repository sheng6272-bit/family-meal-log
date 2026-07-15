const cloud = require('wx-server-sdk');
const {
  createMeal,
  getMeal,
  listMeals,
  updateMeal,
  deleteMeal,
  toClientMeal,
} = require('./lib/shared/services/meal-service');
const {
  listSavedFoods,
  saveFood,
  removeSavedFood,
} = require('./lib/shared/services/food-library-service');
const {
  listRecipes,
  createRecipe,
  updateRecipe,
  deleteRecipe,
} = require('./lib/shared/services/recipe-service');
const { isServiceError } = require('./lib/shared/repository');
const { createRepository } = require('./cloudbase-repository');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

function toErrorResult(error) {
  if (isServiceError(error)) {
    if (error.code === 'not_found') return { ok: false, error: 'not_found' };
    if (error.code === 'forbidden') return { ok: false, error: 'forbidden' };
    if (error.code === 'validation') {
      return { ok: false, error: 'invalid_input', message: error.message };
    }
    return { ok: false, error: error.code, message: error.message };
  }
  console.error('[mealApi] unexpected error', error);
  return { ok: false, error: 'internal_error' };
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) return { ok: false, error: 'no_openid_context' };

  const action = (event && event.action) || 'unknown';
  const repo = createRepository();

  try {
    switch (action) {
      case 'create': {
        const meal = await createMeal(repo, OPENID, event || {});
        return { ok: true, meal: toClientMeal(meal) };
      }
      case 'get': {
        const meal = await getMeal(repo, OPENID, event.mealId);
        return { ok: true, meal: toClientMeal(meal) };
      }
      case 'list': {
        const result = await listMeals(repo, OPENID, event.familyProfileId, event.date);
        return { ok: true, meals: result.meals, totals: result.totals };
      }
      case 'update': {
        const meal = await updateMeal(repo, OPENID, event.mealId, event || {});
        return { ok: true, meal: toClientMeal(meal) };
      }
      case 'delete': {
        await deleteMeal(repo, OPENID, event.mealId);
        return { ok: true };
      }
      case 'listLibrary': {
        const savedFoods = await listSavedFoods(repo, OPENID);
        const recipes = await listRecipes(repo, OPENID);
        return { ok: true, savedFoods, recipes };
      }
      case 'saveFood': {
        const food = await saveFood(repo, OPENID, event.food || event || {});
        return { ok: true, food };
      }
      case 'deleteSavedFood': {
        await removeSavedFood(repo, OPENID, event.foodId);
        return { ok: true };
      }
      case 'createRecipe': {
        const recipe = await createRecipe(repo, OPENID, event || {});
        return { ok: true, recipe };
      }
      case 'updateRecipe': {
        const recipe = await updateRecipe(repo, OPENID, event.recipeId, event || {});
        return { ok: true, recipe };
      }
      case 'deleteRecipe': {
        await deleteRecipe(repo, OPENID, event.recipeId);
        return { ok: true };
      }
      default:
        return { ok: false, error: `unsupported action: ${action}` };
    }
  } catch (error) {
    return toErrorResult(error);
  }
};
