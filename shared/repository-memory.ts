import type {
  AiAnalysis,
  FamilyProfile,
  Food,
  IdempotencyKey,
  Meal,
  Recipe,
  User,
} from './types';
import type { Repository } from './repository';

export class InMemoryRepository implements Repository {
  private users: User[] = [];
  private profiles: FamilyProfile[] = [];
  private meals: Meal[] = [];
  private foods: Food[] = [];
  private recipes: Recipe[] = [];
  private aiAnalyses: AiAnalysis[] = [];
  private idempotencyKeys: IdempotencyKey[] = [];

  async findUserByOpenid(openid: string): Promise<User | null> {
    return this.users.find((user) => user.openid === openid) ?? null;
  }

  async saveUser(user: User): Promise<User> {
    const index = this.users.findIndex((candidate) => candidate.openid === user.openid);
    if (index >= 0) {
      this.users[index] = { ...user };
      return this.users[index];
    }
    const stored = { ...user };
    this.users.push(stored);
    return stored;
  }

  async updateUserDefault(openid: string, profileId: string | null): Promise<void> {
    const user = this.users.find((candidate) => candidate.openid === openid);
    if (user) user.defaultFamilyProfileId = profileId ?? undefined;
  }

  async listProfiles(openid: string): Promise<FamilyProfile[]> {
    return this.profiles.filter((profile) => profile.ownerOpenid === openid);
  }

  async getProfile(id: string): Promise<FamilyProfile | null> {
    return this.profiles.find((profile) => profile._id === id) ?? null;
  }

  async createProfile(profile: FamilyProfile): Promise<FamilyProfile> {
    const stored = {
      ...profile,
      _id: profile._id ?? `profile_${this.profiles.length + 1}`,
    };
    this.profiles.push(stored);
    return stored;
  }

  async updateProfile(id: string, patch: Partial<FamilyProfile>): Promise<FamilyProfile> {
    const index = this.profiles.findIndex((profile) => profile._id === id);
    if (index < 0) throw new Error('profile not found');
    const { _id, ...rest } = patch;
    void _id;
    this.profiles[index] = { ...this.profiles[index], ...rest };
    return this.profiles[index];
  }

  async createMeal(meal: Meal): Promise<Meal> {
    const existing = this.meals.find(
      (candidate) =>
        candidate.ownerOpenid === meal.ownerOpenid &&
        candidate.requestId === meal.requestId,
    );
    if (existing) return existing;
    const stored = { ...meal, _id: meal._id ?? `meal_${this.meals.length + 1}` };
    this.meals.push(stored);
    return stored;
  }

  async getMeal(id: string): Promise<Meal | null> {
    return this.meals.find((meal) => meal._id === id) ?? null;
  }

  async listMeals(openid: string, familyProfileId: string, date: string): Promise<Meal[]> {
    return this.meals.filter(
      (meal) =>
        meal.ownerOpenid === openid &&
        meal.familyProfileId === familyProfileId &&
        meal.date === date,
    );
  }

  async updateMeal(id: string, patch: Partial<Meal>): Promise<Meal> {
    const index = this.meals.findIndex((meal) => meal._id === id);
    if (index < 0) throw new Error('meal not found');
    const { _id, ...rest } = patch;
    void _id;
    this.meals[index] = { ...this.meals[index], ...rest };
    return this.meals[index];
  }

  async deleteMeal(id: string): Promise<void> {
    this.meals = this.meals.filter((meal) => meal._id !== id);
  }

  async listFoods(openid: string): Promise<Food[]> {
    return this.foods.filter((food) => food.ownerOpenid === openid);
  }

  async getFood(id: string): Promise<Food | null> {
    return this.foods.find((food) => food._id === id) ?? null;
  }

  async createFood(food: Food): Promise<Food> {
    const stored = { ...food, _id: food._id ?? `food_${this.foods.length + 1}` };
    this.foods.push(stored);
    return stored;
  }

  async deleteFood(id: string): Promise<void> {
    this.foods = this.foods.filter((food) => food._id !== id);
  }

  async listRecipes(openid: string): Promise<Recipe[]> {
    return this.recipes.filter((recipe) => recipe.ownerOpenid === openid);
  }

  async getRecipe(id: string): Promise<Recipe | null> {
    return this.recipes.find((recipe) => recipe._id === id) ?? null;
  }

  async createRecipe(recipe: Recipe): Promise<Recipe> {
    const stored = { ...recipe, _id: recipe._id ?? `recipe_${this.recipes.length + 1}` };
    this.recipes.push(stored);
    return stored;
  }

  async updateRecipe(id: string, patch: Partial<Recipe>): Promise<Recipe> {
    const index = this.recipes.findIndex((recipe) => recipe._id === id);
    if (index < 0) throw new Error('recipe not found');
    const { _id, ...rest } = patch;
    void _id;
    this.recipes[index] = { ...this.recipes[index], ...rest };
    return this.recipes[index];
  }

  async deleteRecipe(id: string): Promise<void> {
    this.recipes = this.recipes.filter((recipe) => recipe._id !== id);
  }

  async createAiAnalysis(analysis: AiAnalysis): Promise<AiAnalysis> {
    const stored = {
      ...analysis,
      _id: analysis._id ?? `analysis_${this.aiAnalyses.length + 1}`,
    };
    this.aiAnalyses.push(stored);
    return stored;
  }

  async getAiAnalysis(id: string): Promise<AiAnalysis | null> {
    return this.aiAnalyses.find((analysis) => analysis._id === id) ?? null;
  }

  async findIdempotencyKey(
    ownerOpenid: string,
    operation: string,
    requestId: string,
  ): Promise<IdempotencyKey | null> {
    return (
      this.idempotencyKeys.find(
        (record) =>
          record.ownerOpenid === ownerOpenid &&
          record.operation === operation &&
          record.requestId === requestId,
      ) ?? null
    );
  }

  async saveIdempotencyKey(record: IdempotencyKey): Promise<void> {
    const existing = await this.findIdempotencyKey(
      record.ownerOpenid,
      record.operation,
      record.requestId,
    );
    if (existing) return;
    this.idempotencyKeys.push({
      ...record,
      _id: record._id ?? `idem_${this.idempotencyKeys.length + 1}`,
    });
  }
}
