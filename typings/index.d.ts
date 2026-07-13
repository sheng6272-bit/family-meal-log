/**
 * Ambient project typings.
 */

/**
 * Relation of a family profile to the account owner.
 * Mirrors `FAMILY_RELATIONS` in shared/constants. Declared here as a global
 * ambient type so every page/service can use it without a runtime import
 * (the client uses `import type` from shared, and this keeps the global
 * surface consistent).
 */
type FamilyRelation = 'self' | 'spouse' | 'child' | 'parent' | 'other';

/** Client-safe family-profile summary. Never carries openid / ownerOpenid. */
interface ClientFamilyProfile {
  _id: string;
  name: string;
  relation: FamilyRelation;
  /**
   * Computed by the server DTO as (profile id === users.defaultFamilyProfileId).
   * Not a persisted field on family_profiles.
   */
  isDefault: boolean;
}

interface IAppGlobalData {
  /** Whether the CloudBase environment is configured and initialized. */
  cloudReady: boolean;
  /** Internal user document id (non-sensitive). Never an openid. */
  userId?: string;
  /** Server-side default family profile id for this user. */
  defaultFamilyProfileId?: string;
  /** The caller's profiles (client-safe summaries; no ownership fields). */
  profiles: ClientFamilyProfile[];
  /** Locally remembered active profile id (profile id only, never credentials). */
  activeFamilyProfileId?: string;
  /** True once the session (login + profiles) has been loaded at least once. */
  sessionLoaded?: boolean;
}

interface IAppOption {
  globalData: IAppGlobalData;
}
