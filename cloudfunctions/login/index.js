/**
 * login cloud function (M1).
 *
 * Resolves the caller identity from the trusted WeChat cloud-function context
 * and upserts the `users` document. The client NEVER supplies its own openid;
 * the openid used here is the server-derived value from getWXContext().
 *
 * Returns only a NON-SENSITIVE client response (internal user id + default
 * profile id). It deliberately does NOT return openid / unionid to the client.
 */
const cloud = require('wx-server-sdk');
const { upsertUser } = require('./lib/shared/services/user-service');
const { createRepository } = require('./cloudbase-repository');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async () => {
  const { OPENID, UNIONID } = cloud.getWXContext();
  if (!OPENID) {
    return { ok: false, error: 'no_openid_context' };
  }

  const repo = createRepository();
  const { user, isNew } = await upsertUser(repo, OPENID, UNIONID || null);

  return {
    ok: true,
    user: {
      id: user._id || null,
      defaultFamilyProfileId: user.defaultFamilyProfileId || null,
    },
    isNewUser: isNew,
  };
};
