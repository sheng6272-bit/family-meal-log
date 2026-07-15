import type {
  AiAnalysis,
  FamilyProfile,
  Food,
  IdempotencyKey,
  Meal,
  Recipe,
  User,
} from './types';

export type ServiceErrorCode =
  | 'not_found'
  | 'forbidden'
  | 'validation'
  | 'invalid_input';

export class ServiceError extends Error {
  readonly code: ServiceErrorCode;

  constructor(code: ServiceErrorCode, message: string) {
    super(message);
    this.name = 'ServiceError';
    this.code = code;
  }
}

export function isServiceError(value: unknown): value is ServiceError {
  return (
    value instanceof ServiceError ||
    (typeof value === 'object' &&
      value !== null &&
      'code' in value &&
      typeof (value as { code: unknown }).code === 'string')
  );
}

export interface Repository {
  findUserByOpenid(openid: string): Promise<User | null>;
  saveUser(user: User): Promise<User>;
  updateUserDefault(openid: string, profileId: string | null): Promise<void>;

  listProfiles(openid: string): Promise<FamilyProfile[]>;
  getProfile(id: string): Promise<FamilyProfile | null>;
  createProfile(profile: FamilyProfile): Promise<FamilyProfile>;
  updateProfile(id: string, patch: Partial<FamilyProfile>): Promise<FamilyProfile>;

  createMeal(meal: Meal): Promise<Meal>;
  getMeal(id: string): Promise<Meal | null>;
  listMeals(openid: string, familyProfileId: string, date: string): Promise<Meal[]>;
  updateMeal(id: string, patch: Partial<Meal>): Promise<Meal>;
  deleteMeal(id: string): Promise<void>;

  listFoods(openid: string): Promise<Food[]>;
  getFood(id: string): Promise<Food | null>;
  createFood(food: Food): Promise<Food>;
  deleteFood(id: string): Promise<void>;

  listRecipes(openid: string): Promise<Recipe[]>;
  getRecipe(id: string): Promise<Recipe | null>;
  createRecipe(recipe: Recipe): Promise<Recipe>;
  updateRecipe(id: string, patch: Partial<Recipe>): Promise<Recipe>;
  deleteRecipe(id: string): Promise<void>;

  createAiAnalysis(analysis: AiAnalysis): Promise<AiAnalysis>;
  getAiAnalysis(id: string): Promise<AiAnalysis | null>;

  findIdempotencyKey(
    ownerOpenid: string,
    operation: string,
    requestId: string,
  ): Promise<IdempotencyKey | null>;
  saveIdempotencyKey(record: IdempotencyKey): Promise<void>;
}
