const cloud = require('wx-server-sdk');
const { analyzeMealPhoto } = require('./lib/shared/services/ai-analysis-service');
const { createRepository } = require('./cloudbase-repository');
const { createMockProvider } = require('./providers/mock');
const { createOpenAiCompatibleProvider } = require('./providers/openai-compatible');
const { isServiceError } = require('./lib/shared/repository');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

function getProvider(env) {
  const providerName = env.AI_PROVIDER || 'mock';
  if (providerName === 'disabled') {
    return {
      name: 'disabled',
      async analyze() {
        return {
          provider: 'disabled',
          status: 'failed',
          suggestions: [],
          errorMessage: 'AI provider disabled',
        };
      },
    };
  }
  if (providerName === 'mock') return createMockProvider();
  return createOpenAiCompatibleProvider(env);
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
    const provider = getProvider(process.env);
    const result = await analyzeMealPhoto(repo, OPENID, event || {}, provider);
    return { ok: true, ...result };
  } catch (error) {
    return toErrorResult(error);
  }
};
