const cloud = require('wx-server-sdk');
const { analyzeMealPhoto } = require('./lib/shared/services/ai-analysis-service');
const { createRepository } = require('./cloudbase-repository');
const { createMockProvider } = require('./providers/mock');
const { createOpenAiCompatibleProvider } = require('./providers/openai-compatible');
const { isServiceError } = require('./lib/shared/repository');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

function createFailedProvider(name, errorMessage) {
  return {
    name,
    async analyze() {
      return {
        provider: name,
        status: 'failed',
        suggestions: [],
        errorMessage,
      };
    },
  };
}

function getProvider(env, repo) {
  const providerName =
    typeof env.AI_PROVIDER === 'string' && env.AI_PROVIDER.trim()
      ? env.AI_PROVIDER.trim()
      : 'mock';

  switch (providerName) {
    case 'disabled':
      return createFailedProvider('disabled', 'AI provider disabled');
    case 'mock':
      return createMockProvider();
    case 'openai-compatible':
      return createOpenAiCompatibleProvider(env, {
        resolveImageUrl: (photoFileId) => repo.resolvePhotoTempUrl(photoFileId),
      });
    default:
      return createFailedProvider(
        providerName,
        `Unsupported AI_PROVIDER value "${providerName}". Supported values: disabled, mock, openai-compatible.`,
      );
  }
}

function toErrorResult(error) {
  if (isServiceError(error)) {
    if (error.code === 'validation') {
      return { ok: false, error: 'invalid_input', message: error.message };
    }
    return { ok: false, error: error.code, message: error.message };
  }
  console.error('[aiAnalyze] unexpected error', error);
  return { ok: false, error: 'internal_error' };
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) return { ok: false, error: 'no_openid_context' };

  try {
    const repo = createRepository();
    const provider = getProvider(process.env, repo);
    const result = await analyzeMealPhoto(repo, OPENID, event || {}, provider);
    return { ok: true, ...result };
  } catch (error) {
    return toErrorResult(error);
  }
};
