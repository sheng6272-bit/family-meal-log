/**
 * Provider-neutral AI adapter (client-facing contract).
 *
 * The client NEVER calls an external AI vendor directly. It calls this adapter,
 * which in production routes to the `aiAnalyze` cloud function. The cloud
 * function selects the concrete provider (mock or real) server-side, keeping
 * all secrets off the device.
 *
 * ARCHITECTURE RULE: AI output is advisory only. It produces *suggestions* the
 * user must confirm/correct. It is never the source of nutritional truth - the
 * shared nutrition layer always recomputes final numbers from confirmed input.
 */
import type { AiAnalysisRequest, AiAnalysisResult } from '../../../shared/types';
import { analyzeWithMock } from './mock-provider';
import { isCloudReady, callFunction } from '../cloud';

export interface AiProvider {
  readonly name: string;
  analyze(request: AiAnalysisRequest): Promise<AiAnalysisResult>;
}

/**
 * Analyze a meal photo and return suggestions.
 * Falls back to the local mock provider whenever the cloud/AI path is
 * unavailable, so the app remains fully usable without any AI service.
 */
export async function analyzeMealPhoto(
  request: AiAnalysisRequest,
): Promise<AiAnalysisResult> {
  if (isCloudReady()) {
    try {
      return await callFunction<AiAnalysisResult>('aiAnalyze', {
        photoFileId: request.photoFileId,
        hintMealType: request.hintMealType,
      });
    } catch (err) {
      console.warn('[ai] cloud analyze failed, falling back to mock', err);
    }
  }
  // Offline / not-yet-configured path: deterministic mock suggestions.
  return analyzeWithMock(request);
}
