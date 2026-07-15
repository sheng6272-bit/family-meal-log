/**
 * In-memory Repository used by the automated validation/test command.
 * It mirrors the semantics of the CloudBase-backed repository so the same
 * business logic is exercised in CI as in production, with no WeChat SDK or
 * network access.
 */

import type { User, FamilyProfile, IdempotencyKey, Meal } from './types';
import type { Repository } from './repository';

export class InMemoryRepository implements Repository {
  private users: User[] = [];
  private profiles: FamilyProfile[] = [];
  private meals: Meal[] = [];
  private idempotencyKeys: IdempotencyKey[] = [];

  async findUserByOpenid(openid: string): Promise<User | null> {
    return this.users.find((u) => u.openid === openid) ?? null;
  }

  async saveUser(user: User): Promise<User> {
    const idx = this.users.findIndex((u) => u.openid === user.openid);
    if (idx >= 0) {
      this.users[idx] = { ...user };
      return this.users[idx];
    }
    const stored: User = { ...user };
    this.users.push(stored);
    return stored;
  }

  async updateUserDefault(openid: string, profileId: string | null): Promise<void> {
    const u = this.users.find((x) => x.openid === openid);
    if (u) u.defaultFamilyProfileId = profileId ?? undefined;
  }

  async listProfiles(openid: string): Promise<FamilyProfile[]> {
    return this.profiles.filter((p) => p.ownerOpenid === openid);
  }

  async getProfile(id: string): Promise<FamilyProfile | null> {
    return this.profiles.find((p) => p._id === id) ?? null;
  }

  async createProfile(profile: FamilyProfile): Promise<FamilyProfile> {
    const stored: FamilyProfile = {
      ...profile,
      _id: profile._id ?? `mem_${this.profiles.length + 1}`,
    };
    this.profiles.push(stored);
    return stored;
  }

  async updateProfile(id: string, patch: Partial<FamilyProfile>): Promise<FamilyProfile> {
    const idx = this.profiles.findIndex((p) => p._id === id);
    if (idx < 0) throw new Error('profile not found');
    const { _id, ...rest } = patch;
    void _id;
    const merged: FamilyProfile = { ...this.profiles[idx], ...rest };
    this.profiles[idx] = merged;
    return merged;
  }

  async createMeal(meal: Meal): Promise<Meal> {
    const existing = this.meals.find(
      (m) => m.ownerOpenid === meal.ownerOpenid && m.requestId === meal.requestId,
    );
    if (existing) return existing;
    const stored: Meal = {
      ...meal,
      _id: meal._id ?? `meal_${this.meals.length + 1}`,
    };
    this.meals.push(stored);
    return stored;
  }

  async getMeal(id: string): Promise<Meal | null> {
    return this.meals.find((m) => m._id === id) ?? null;
  }

  async findIdempotencyKey(
    ownerOpenid: string,
    operation: string,
    requestId: string,
  ): Promise<IdempotencyKey | null> {
    return (
      this.idempotencyKeys.find(
        (k) =>
          k.ownerOpenid === ownerOpenid &&
          k.operation === operation &&
          k.requestId === requestId,
      ) ?? null
    );
  }

  async saveIdempotencyKey(record: IdempotencyKey): Promise<void> {
    // Mirror a unique (ownerOpenid, operation, requestId) index: ignore repeats.
    const exists = await this.findIdempotencyKey(
      record.ownerOpenid,
      record.operation,
      record.requestId,
    );
    if (exists) return;
    this.idempotencyKeys.push({
      ...record,
      _id: record._id ?? `idem_${this.idempotencyKeys.length + 1}`,
    });
  }
}
