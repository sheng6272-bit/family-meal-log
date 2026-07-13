/**
 * Mock AI provider. Deterministic, offline, no external calls, no secrets.
 * Used before any real provider integration and as the permanent fallback.
 * Its suggestions are intentionally clearly-labelled estimates.
 */
import type {
  AiAnalysisRequest,
  AiAnalysisResult,
  AiFoodSuggestion,
} from '../../../shared/types';

const MOCK_SUGGESTIONS: AiFoodSuggestion[] = [
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
];

export async function analyzeWithMock(
  request: AiAnalysisRequest,
): Promise<AiAnalysisResult> {
  // No network. Deterministic suggestions; photoFileId is echoed via logs only.
  console.info('[ai:mock] analyzing photo', request.photoFileId);
  return Promise.resolve({
    provider: 'mock',
    status: 'succeeded',
    suggestions: MOCK_SUGGESTIONS.map((s) => ({ ...s })),
  });
}
