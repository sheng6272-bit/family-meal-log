import { AI_ANALYSIS_STATUSES, MEAL_TYPES } from '../constants';
import type { MealType } from '../constants';
import type {
  AiAnalysis,
  AiAnalysisRequest,
  AiAnalysisResult,
  AiFoodSuggestion,
  NutritionValues,
} from '../types';
import type { Repository } from '../repository';
import { ServiceError } from '../repository';
import { validateNutrition } from '../validation';

export interface AiProviderClient {
  readonly name: string;
  analyze(request: AiAnalysisRequest): Promise<AiAnalysisResult>;
}

function asNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ServiceError('validation', `${field} is required`);
  }
  return value.trim();
}

function normalizeSuggestion(
  value: unknown,
  index: number,
): AiFoodSuggestion {
  if (!value || typeof value !== 'object') {
    throw new ServiceError('validation', `suggestions[${index}] must be an object`);
  }
  const input = value as Partial<AiFoodSuggestion>;
  const foodName = asNonEmptyString(input.foodName, `suggestions[${index}].foodName`);
  if (
    typeof input.estimatedGrams !== 'number' ||
    !Number.isFinite(input.estimatedGrams) ||
    input.estimatedGrams <= 0
  ) {
    throw new ServiceError(
      'validation',
      `suggestions[${index}].estimatedGrams must be a finite number > 0`,
    );
  }
  if (
    typeof input.confidence !== 'number' ||
    !Number.isFinite(input.confidence) ||
    input.confidence < 0 ||
    input.confidence > 1
  ) {
    throw new ServiceError(
      'validation',
      `suggestions[${index}].confidence must be between 0 and 1`,
    );
  }
  const result: AiFoodSuggestion = {
    foodName,
    estimatedGrams: input.estimatedGrams,
    confidence: input.confidence,
  };
  if (typeof input.matchedFoodId === 'string' && input.matchedFoodId.trim()) {
    result.matchedFoodId = input.matchedFoodId.trim();
  }
  if (input.per100gGuess !== undefined) {
    const validated = validateNutrition(input.per100gGuess, `suggestions[${index}].per100gGuess`);
    if (!validated.valid) {
      throw new ServiceError('validation', validated.errors.join('; '));
    }
    result.per100gGuess = input.per100gGuess as NutritionValues;
  }
  return result;
}

function truncateErrorMessage(value: string): string {
  return value.length > 180 ? value.slice(0, 180) : value;
}

function normalizeMealType(value: unknown): MealType | undefined {
  if (typeof value !== 'string') return undefined;
  return MEAL_TYPES.includes(value as MealType) ? (value as MealType) : undefined;
}

function normalizeResult(
  providerName: string,
  value: AiAnalysisResult,
): AiAnalysisResult {
  if (!value || typeof value !== 'object') {
    throw new ServiceError('validation', 'provider result must be an object');
  }
  if (!AI_ANALYSIS_STATUSES.includes(value.status)) {
    throw new ServiceError('validation', 'provider result status is invalid');
  }
  if (!Array.isArray(value.suggestions)) {
    throw new ServiceError('validation', 'provider suggestions must be an array');
  }
  return {
    provider: typeof value.provider === 'string' && value.provider.trim()
      ? value.provider.trim()
      : providerName,
    status: value.status,
    suggestions: value.suggestions.map((suggestion, index) =>
      normalizeSuggestion(suggestion, index),
    ),
    errorMessage:
      typeof value.errorMessage === 'string' && value.errorMessage.trim()
        ? truncateErrorMessage(value.errorMessage.trim())
        : undefined,
  };
}

export async function analyzeMealPhoto(
  repo: Repository,
  openid: string,
  input: { photoFileId?: unknown; hintMealType?: unknown },
  provider: AiProviderClient,
): Promise<AiAnalysisResult> {
  if (!openid) throw new ServiceError('invalid_input', 'openid is required');
  const photoFileId = asNonEmptyString(input.photoFileId, 'photoFileId');
  const hintMealType = normalizeMealType(input.hintMealType);
  const now = Date.now();

  let normalized: AiAnalysisResult;
  try {
    const result = await provider.analyze({
      ownerOpenid: openid,
      photoFileId,
      hintMealType,
    });
    normalized = normalizeResult(provider.name, result);
  } catch (error) {
    normalized = {
      provider: provider.name,
      status: 'failed',
      suggestions: [],
      errorMessage: truncateErrorMessage(
        error instanceof Error ? error.message : 'provider failed',
      ),
    };
  }

  const saved = await repo.createAiAnalysis({
    ownerOpenid: openid,
    photoFileId,
    provider: normalized.provider,
    status: normalized.status,
    suggestions: normalized.suggestions,
    errorMessage: normalized.errorMessage,
    createdAt: now,
    updatedAt: now,
  });

  return {
    analysisId: saved._id,
    provider: saved.provider,
    status: saved.status,
    suggestions: saved.suggestions,
    errorMessage: saved.errorMessage,
  };
}

export async function getAiAnalysis(
  repo: Repository,
  openid: string,
  analysisId: string,
): Promise<AiAnalysis> {
  if (!openid) throw new ServiceError('invalid_input', 'openid is required');
  const id = asNonEmptyString(analysisId, 'analysisId');
  const analysis = await repo.getAiAnalysis(id);
  if (!analysis) throw new ServiceError('not_found', 'ai analysis not found');
  if (analysis.ownerOpenid !== openid) {
    throw new ServiceError('forbidden', 'ai analysis does not belong to caller');
  }
  return analysis;
}
