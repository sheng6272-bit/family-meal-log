const cloud = require('wx-server-sdk');
const {
  createMeal,
  getMeal,
  toClientMeal,
} = require('./lib/shared/services/meal-service');
const { isServiceError } = require('./lib/shared/repository');
const { createRepository } = require('./cloudbase-repository');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

function toErrorResult(err) {
  if (isServiceError(err)) {
    if (err.code === 'not_found') return { ok: false, error: 'not_found' };
    if (err.code === 'forbidden') return { ok: false, error: 'forbidden' };
    if (err.code === 'validation') {
      return { ok: false, error: 'invalid_input', message: err.message };
    }
    return { ok: false, error: err.code, message: err.message };
  }
  console.error('[mealApi] unexpected error', err);
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
      default:
        return { ok: false, error: `unsupported action: ${action}` };
    }
  } catch (err) {
    return toErrorResult(err);
  }
};
