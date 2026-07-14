/**
 * Storage boundary (repository) for identity + family profiles.
 *
 * The business logic in `services/*` depends ONLY on this interface, never on
 * the WeChat SDK. That lets authorization and default-setting be unit-tested
 * with the in-memory implementation below, fully independent of CloudBase.
 *
 * The production implementation (`cloudbase-repository.js` inside each cloud
 * function) talks to CloudBase; the test implementation
 * (`repository-memory.ts`) keeps everything in RAM.
 */

import type { User, FamilyProfile, IdempotencyKey } from './types';

/** Machine-readable error codes the cloud functions map to client responses. */
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

/** Type guard that also works across module boundaries (compiled copies). */
export function isServiceError(e: unknown): e is ServiceError {
  return (
    e instanceof ServiceError ||
    (typeof e === 'object' &&
      e !== null &&
      'code' in e &&
      typeof (e as { code: unknown }).code === 'string')
  );
}

export interface Repository {
  /** Find the user document for a (server-derived) openid, or null. */
  findUserByOpenid(openid: string): Promise<User | null>;

  /**
   * Insert a new user, or update the existing one matched by openid.
   * The implementation is responsible for upsert-by-openid semantics.
   */
  saveUser(user: User): Promise<User>;

  /** Set (or clear with null) the user's default family-profile id. */
  updateUserDefault(openid: string, profileId: string | null): Promise<void>;

  /** List the caller's profiles; implementation filters by openid. */
  listProfiles(openid: string): Promise<FamilyProfile[]>;

  /** Fetch a single profile by id (regardless of owner); caller checks ownership. */
  getProfile(id: string): Promise<FamilyProfile | null>;

  /** Insert a new profile; implementation assigns `_id` if missing. */
  createProfile(profile: FamilyProfile): Promise<FamilyProfile>;

  /** Apply a patch to an existing profile (implementation strips `_id`). */
  updateProfile(id: string, patch: Partial<FamilyProfile>): Promise<FamilyProfile>;

  /**
   * Look up a previously stored idempotency record scoped by the trusted owner
   * identity + operation + client-supplied requestId. Returns null when the
   * request has not been seen before. Used to make write operations safely
   * retryable without name-based deduplication.
   */
  findIdempotencyKey(
    ownerOpenid: string,
    operation: string,
    requestId: string,
  ): Promise<IdempotencyKey | null>;

  /**
   * Persist the mapping from (ownerOpenid, operation, requestId) to the id of
   * the record the operation produced. Implementations SHOULD back this with a
   * unique composite index to make the claim race-safe (see SECURITY.md).
   */
  saveIdempotencyKey(record: IdempotencyKey): Promise<void>;
}
