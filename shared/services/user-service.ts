/**
 * Login / user resolution service. Pure logic, no SDK.
 *
 * Identity is ALWAYS derived server-side from the WeChat cloud-function
 * context. The `openid` passed here is the trusted, server-derived value —
 * never a client-supplied credential.
 */

import type { User } from '../types';
import type { Repository } from '../repository';
import { ServiceError } from '../repository';

export interface LoginResult {
  user: User;
  isNew: boolean;
}

/**
 * Resolve (find-or-create) the calling user.
 *
 * Idempotent: repeated calls with the same openid return the SAME user record
 * (isNew becomes false after first creation) and never create duplicates.
 */
export async function upsertUser(
  repo: Repository,
  openid: string,
  unionid?: string | null,
): Promise<LoginResult> {
  if (!openid) throw new ServiceError('invalid_input', 'openid is required');

  const existing = await repo.findUserByOpenid(openid);
  if (existing) {
    const updated: User = {
      ...existing,
      unionid: unionid ?? existing.unionid,
      updatedAt: Date.now(),
    };
    const saved = await repo.saveUser(updated);
    return { user: saved, isNew: false };
  }

  const now = Date.now();
  const user: User = {
    openid,
    unionid: unionid ?? undefined,
    defaultFamilyProfileId: undefined,
    createdAt: now,
    updatedAt: now,
  };
  const saved = await repo.saveUser(user);
  return { user: saved, isNew: true };
}
