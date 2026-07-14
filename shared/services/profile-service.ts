/**
 * Family-profile service. Pure logic, no SDK. Enforces:
 *  - server-side ownership (ownerOpenid derived from the trusted openid)
 *  - input normalization + validation (strip everything but name/relation)
 *  - owner-scoped reads/writes (cross-user access is rejected, not leaked)
 *  - first-profile-becomes-default
 *
 * The cloud functions call these and then map results to CLIENT-SAFE DTOs
 * (no openid / ownerOpenid). See `toClientProfile`.
 */

import type { FamilyProfile } from '../types';
import { FAMILY_RELATIONS } from '../constants';
import type { FamilyRelation } from '../constants';
import type { Repository, ServiceErrorCode } from '../repository';
import { ServiceError } from '../repository';

/** What the client is allowed to see: never the owner identity. */
export interface ClientProfile {
  _id: string;
  name: string;
  relation: FamilyRelation;
  /**
   * Computed, NOT persisted. True when this profile equals the user's
   * `defaultFamilyProfileId` (the single source of truth). Never read from a
   * stored `family_profiles.isDefault` field — that column does not exist.
   */
  isDefault: boolean;
}

/** Raw client input; intentionally loose so we can reject unknown/ownership fields. */
export interface ProfileInput {
  name?: unknown;
  relation?: unknown;
  [key: string]: unknown;
}

const NAME_MAX = 30;

/**
 * Normalize + validate client input. STRIPS every field except `name` and
 * `relation`; ownership/timestamp fields (_id, ownerOpenid, createdAt,
 * updatedAt) are assigned server-side and any client-supplied values are
 * dropped. Throws ServiceError('validation') on bad input.
 */
export function normalizeProfileInput(input: ProfileInput): {
  name: string;
  relation: FamilyRelation;
} {
  if (!input || typeof input !== 'object') {
    throw new ServiceError('validation', 'profile input must be an object');
  }
  const rawName = typeof input.name === 'string' ? input.name.trim() : '';
  if (rawName.length === 0) {
    throw new ServiceError('validation', 'name must not be empty');
  }
  if (rawName.length > NAME_MAX) {
    throw new ServiceError('validation', `name must be at most ${NAME_MAX} characters`);
  }
  const relation = input.relation;
  if (
    typeof relation !== 'string' ||
    !FAMILY_RELATIONS.includes(relation as FamilyRelation)
  ) {
    throw new ServiceError(
      'validation',
      `relation must be one of ${FAMILY_RELATIONS.join(', ')}`,
    );
  }
  // Only these two fields ever leave this function.
  return { name: rawName, relation: relation as FamilyRelation };
}

/**
 * Map a stored profile to a client-safe shape (drops ownerOpenid). `isDefault`
 * is COMPUTED against the user's single-source-of-truth default id; it is never
 * read from the profile document.
 */
export function toClientProfile(
  p: FamilyProfile,
  defaultProfileId?: string | null,
): ClientProfile {
  const id = p._id as string;
  return {
    _id: id,
    name: p.name,
    relation: p.relation,
    isDefault: !!defaultProfileId && id === defaultProfileId,
  };
}

/** List the caller's profiles, ordered by createdAt ascending (deterministic). */
export async function listProfiles(
  repo: Repository,
  openid: string,
): Promise<FamilyProfile[]> {
  if (!openid) throw new ServiceError('invalid_input', 'openid is required');
  const profiles = await repo.listProfiles(openid);
  return profiles.slice().sort((a, b) => a.createdAt - b.createdAt);
}

/** Fetch one profile the caller owns (ownership enforced). */
export async function getProfile(
  repo: Repository,
  openid: string,
  profileId: string,
): Promise<FamilyProfile> {
  if (!openid) throw new ServiceError('invalid_input', 'openid is required');
  const profile = await repo.getProfile(profileId);
  if (!profile) throw new ServiceError('not_found', 'profile not found');
  if (profile.ownerOpenid !== openid) {
    throw new ServiceError('forbidden', 'profile does not belong to caller');
  }
  return profile;
}

const CREATE_OP = 'create';

/**
 * Create a profile for the caller.
 *  - ownership (ownerOpenid) is set server-side from the trusted openid.
 *  - client ownership/timestamp fields are ignored via normalizeProfileInput.
 *  - the caller's FIRST profile is automatically set as their default.
 *
 * Duplicate handling: names are NOT unique. Two profiles with the same name are
 * a legitimate business case (e.g. two children called "宝宝"). Safe retries are
 * handled by REQUEST-LEVEL idempotency: when the client supplies a stable
 * high-entropy `requestId`, a repeated create scoped by
 * (ownerOpenid + operation + requestId) returns the originally created profile.
 * A different `requestId` always creates a new profile, even with identical
 * name/relation. When no `requestId` is supplied, every call creates a new
 * profile (the client UI in-flight guard is the only protection — see the
 * residual-risk note in SECURITY.md).
 */
export async function createProfile(
  repo: Repository,
  openid: string,
  input: ProfileInput,
  requestId?: string,
): Promise<FamilyProfile> {
  if (!openid) throw new ServiceError('invalid_input', 'openid is required');
  const { name, relation } = normalizeProfileInput(input);

  // Request-level idempotency (scoped by the trusted owner identity).
  const key =
    typeof requestId === 'string' && requestId.trim().length > 0
      ? requestId.trim()
      : undefined;
  if (key) {
    const seen = await repo.findIdempotencyKey(openid, CREATE_OP, key);
    if (seen) {
      const prior = await repo.getProfile(seen.resultId);
      // Only return it if it still exists AND belongs to this caller.
      if (prior && prior.ownerOpenid === openid) return prior;
    }
  }

  const existing = await repo.listProfiles(openid);
  const now = Date.now();
  const profile: FamilyProfile = {
    ownerOpenid: openid, // server-derived; any client value is ignored
    name,
    relation,
    createdAt: now,
    updatedAt: now,
  };
  const created = await repo.createProfile(profile);

  // First profile for this owner → auto default (single source of truth on user).
  if (existing.length === 0) {
    await repo.updateUserDefault(openid, created._id as string);
  }

  if (key) {
    await repo.saveIdempotencyKey({
      ownerOpenid: openid,
      operation: CREATE_OP,
      requestId: key,
      resultId: created._id as string,
      createdAt: now,
    });
  }
  return created;
}

/**
 * Update editable fields (name, relation) of a profile the caller owns.
 * Rejects missing or foreign-owned profiles without leaking that another
 * user's data exists.
 */
export async function updateProfile(
  repo: Repository,
  openid: string,
  profileId: string,
  patch: ProfileInput,
): Promise<FamilyProfile> {
  if (!openid) throw new ServiceError('invalid_input', 'openid is required');
  const current = await repo.getProfile(profileId);
  if (!current) throw new ServiceError('not_found', 'profile not found');
  if (current.ownerOpenid !== openid) {
    throw new ServiceError('forbidden', 'profile does not belong to caller');
  }

  const next = normalizeProfileInput({ ...current, ...patch });
  const updated: FamilyProfile = {
    ...current,
    name: next.name,
    relation: next.relation,
    updatedAt: Date.now(),
  };
  return repo.updateProfile(profileId, updated);
}

/** Set the caller's default profile (ownership enforced). */
export async function setDefaultProfile(
  repo: Repository,
  openid: string,
  profileId: string,
): Promise<string> {
  if (!openid) throw new ServiceError('invalid_input', 'openid is required');
  const profile = await repo.getProfile(profileId);
  if (!profile) throw new ServiceError('not_found', 'profile not found');
  if (profile.ownerOpenid !== openid) {
    throw new ServiceError('forbidden', 'profile does not belong to caller');
  }
  await repo.updateUserDefault(openid, profileId);
  return profileId;
}

export type { ServiceErrorCode };
