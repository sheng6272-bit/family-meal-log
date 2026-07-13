/**
 * aiAnalyze cloud function (provider-neutral, mock-only for now).
 *
 * The provider is selected by the AI_PROVIDER environment variable configured
 * in the CloudBase console (NOT in this repo). Default is "mock", which uses no
 * external network and no secrets. Real providers are added later behind the
 * SAME interface; the client never changes.
 *
 * SECURITY: any real API key is read from process.env at runtime (configured in
 * the CloudBase function environment). It is never stored in source control.
 *
 * Output is ADVISORY ONLY: the client must let the user confirm/correct
 * suggestions, and final nutrition is always recomputed from confirmed input.
 */
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

function analyzeWithMock(event) {
  return {
    provider: 'mock',
    status: 'succeeded',
    suggestions: [
      {
        foodName: '米饭',
        estimatedGrams: 150,
        confidence: 0.62,
        per100gGuess: { calories: 130, protein: 2.7, carb: 28, fat: 0.3 },
      },
      {
        foodName: '西兰花',
        estimatedGrams: 80,
        confidence: 0.55,
        per100gGuess: { calories: 34, protein: 2.8, carb: 7, fat: 0.4 },
      },
    ],
    photoFileId: (event && event.photoFileId) || null,
  };
}

exports.main = async (event) => {
  const provider = process.env.AI_PROVIDER || 'mock';

  // Only the mock provider is wired in this foundation task.
  if (provider !== 'mock') {
    // Fail safe: never break the app. Return an empty, failed result so the
    // client falls back to the manual workflow.
    return {
      provider,
      status: 'failed',
      suggestions: [],
      errorMessage: `provider "${provider}" not integrated yet`,
    };
  }

  return analyzeWithMock(event);
};
