/**
 * profileApi cloud function (M1).
 *
 * Server-trusted family-profile management. The caller identity is derived
 * from the WeChat cloud-function context; clients NEVER send openid. All
 * responses are client-safe (no openid / ownerOpenid is returned).
 *
 * Actions:
 *   list       -> profiles belonging to the caller (createdAt ascending)
 *   get        -> one profile the caller owns
 *   create     -> validate + normalize + create (first profile becomes default)
 *   update     -> update name/relation of a profile the caller owns
 *   setDefault -> set the caller's default profile
 */
const cloud = require('wx-server-sdk');
const {
  listProfiles,
  createProfile,
  updateProfile,
  setDefaultProfile,
  getProfile,
  toClientProfile,
} = require('./lib/shared/services/profile-service');
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
  console.error('[profileApi] unexpected error', err);
  return { ok: false, error: 'internal_error' };
}

/** Read the caller's single-source-of-truth default profile id (or null). */
async function currentDefaultId(repo, openid) {
  const user = await repo.findUserByOpenid(openid);
  return (user && user.defaultFamilyProfileId) || null;
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) return { ok: false, error: 'no_openid_context' };

  const action = (event && event.action) || 'unknown';
  const repo = createRepository();

  try {
    switch (action) {
      case 'list': {
        const profiles = await listProfiles(repo, OPENID);
        const defaultId = await currentDefaultId(repo, OPENID);
        return { ok: true, profiles: profiles.map((p) => toClientProfile(p, defaultId)) };
      }
      case 'get': {
        const profile = await getProfile(repo, OPENID, event.profileId);
        const defaultId = await currentDefaultId(repo, OPENID);
        return { ok: true, profile: toClientProfile(profile, defaultId) };
      }
      case 'create': {
        const created = await createProfile(
          repo,
          OPENID,
          event.profile || {},
          event.requestId,
        );
        const defaultId = await currentDefaultId(repo, OPENID);
        return { ok: true, profile: toClientProfile(created, defaultId) };
      }
      case 'update': {
        const updated = await updateProfile(
          repo,
          OPENID,
          event.profileId,
          event.patch || {},
        );
        const defaultId = await currentDefaultId(repo, OPENID);
        return { ok: true, profile: toClientProfile(updated, defaultId) };
      }
      case 'setDefault': {
        const defaultId = await setDefaultProfile(repo, OPENID, event.profileId);
        return { ok: true, defaultFamilyProfileId: defaultId };
      }
      default:
        return { ok: false, error: `unsupported action: ${action}` };
    }
  } catch (err) {
    return toErrorResult(err);
  }
};
