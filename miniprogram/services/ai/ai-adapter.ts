import type { AiAnalysisRequest, AiAnalysisResult } from '../../../shared/types';
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

function failedResult(
  provider: string,
  errorMessage: string,
  analysisId?: string,
): AiAnalysisResult {
  return {
    analysisId,
    provider,
    status: 'failed',
    suggestions: [],
    errorMessage,
  };
}

export async function analyzeMealPhoto(
  request: AiAnalysisRequest,
): Promise<AiAnalysisResult> {
  if (!isCloudReady()) {
    return failedResult('disabled', 'AI 云能力当前不可用，请继续手动添加。');
  }

  try {
    const res = await callFunction<AiFunctionResponse>('aiAnalyze', {
      photoFileId: request.photoFileId,
      hintMealType: request.hintMealType,
    });
    if (res.ok === false) {
      return failedResult(
        res.provider || 'cloud',
        res.message || res.error || 'AI 分析暂时不可用，请继续手动添加。',
        res.analysisId,
      );
    }
    return {
      analysisId: res.analysisId,
      provider: res.provider,
      status: res.status,
      suggestions: res.suggestions || [],
      errorMessage: res.errorMessage,
    };
  } catch (err) {
    console.warn('[ai] cloud analyze failed', err);
    return failedResult('cloud', 'AI 分析暂时不可用，请继续手动添加。');
  }
}
