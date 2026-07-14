/**
 * mealApi cloud function (placeholder).
 * Intended as the server entry for meal CRUD once implemented. It will:
 *   - derive openid from context (never trust client-supplied openid)
 *   - re-validate payloads with the SHARED validators (server-side trust)
 *   - recompute nutrition totals via the SHARED nutrition layer
 * For this foundation task it only routes and returns not-implemented.
 *
 * action: 'create' | 'update' | 'delete' | 'listByDate'
 */
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const action = (event && event.action) || 'unknown';

  const supported = ['create', 'update', 'delete', 'listByDate'];
  if (!supported.includes(action)) {
    return { ok: false, error: `unsupported action: ${action}` };
  }

  // Placeholder: real implementation lands in the meal-logging milestone.
  // NOTE: openid is derived server-side and is NOT returned to the client.
  return {
    ok: false,
    error: 'not_implemented',
    action,
  };
};
