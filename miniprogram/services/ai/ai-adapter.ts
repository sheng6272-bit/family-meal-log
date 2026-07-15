import type { AiAnalysisRequest, AiAnalysisResult } from '../../../shared/types';
import { analyzeWithMock } from './mock-provider';
import { isCloudReady, callFunction } from '../cloud';

interface AiFunctionResponse extends AiAnalysisResult {
  ok?: boolean;
  error?: string;
  message?: string;
}

export interface AiProvider {
  readonly name: string;
  analyze(request: AiAnalysisRequest): Promise<AiAnalysisResult>;
}

export async function analyzeMealPhoto(
  request: AiAnalysisRequest,
): Promise<AiAnalysisResult> {
  if (isCloudReady()) {
    try {
      const res = await callFunction<AiFunctionResponse>('aiAnalyze', {
        photoFileId: request.photoFileId,
        hintMealType: request.hintMealType,
      });
      if (res.ok === false) {
        throw new Error(res.message || res.error || 'ai_analyze_failed');
      }
      return {
        analysisId: res.analysisId,
        provider: res.provider,
        status: res.status,
        suggestions: res.suggestions || [],
        errorMessage: res.errorMessage,
      };
    } catch (err) {
      console.warn('[ai] cloud analyze failed, falling back to mock', err);
    }
  }
  return analyzeWithMock(request);
}
