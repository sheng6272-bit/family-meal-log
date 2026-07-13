/**
 * In-memory Repository used by the automated validation/test command.
 * It mirrors the semantics of the CloudBase-backed repository so the same
 * business logic is exercised in CI as in production, with no WeChat SDK or
 * network access.
 */

import type { User, FamilyProfile } from './types';
import type { Repository } from './repository';

export class InMemoryRepository implements Repository {
  private users: User[] = [];
  private profiles: FamilyProfile[] = [];

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
}
