/**
 * Profile service. Wraps the `profileApi` cloud function.
 *
 * All identity/ownership is handled server-side; these calls only send the
 * intended name/relation and a profile id. Responses are client-safe
 * (no openid / ownerOpenid). On validation failure the server returns
 * `error: 'invalid_input'` with a `message` we surface to the user.
 */

import { isCloudReady, callFunction } from './cloud';

export type ClientProfile = ClientFamilyProfile;

export interface ProfileInput {
  name: string;
  relation: FamilyRelation;
}

/**
 * Generate a high-entropy client request id used for server-side create
 * idempotency (ownerOpenid + operation + requestId). This lets a retried create
 * safely return the original profile instead of creating a duplicate, WITHOUT
 * using name as a uniqueness key.
 */
export function newRequestId(): string {
  const rand = Math.random().toString(36).slice(2);
  const rand2 = Math.random().toString(36).slice(2);
  return `req_${Date.now().toString(36)}_${rand}${rand2}`;
}

interface ApiResult {
  ok: boolean;
  profiles?: ClientProfile[];
  profile?: ClientProfile;
  defaultFamilyProfileId?: string;
  error?: string;
  message?: string;
}

function req<T>(action: string, data: Record<string, unknown> = {}): Promise<T> {
  if (!isCloudReady()) throw new Error('cloud_not_ready');
  return callFunction<T>('profileApi', { action, ...data });
}

export async function listProfiles(): Promise<ClientProfile[]> {
  const res = await req<ApiResult>('list');
  if (!res.ok) throw new Error(res.error || 'list_failed');
  return res.profiles || [];
}

export async function createProfile(
  input: ProfileInput,
  requestId?: string,
): Promise<ClientProfile> {
  const res = await req<ApiResult>('create', {
    profile: input,
    requestId: requestId || newRequestId(),
  });
  if (!res.ok) throw new Error(toError(res, 'create_failed'));
  if (!res.profile) throw new Error('create_failed');
  return res.profile;
}

export async function updateProfile(
  profileId: string,
  input: ProfileInput,
): Promise<ClientProfile> {
  const res = await req<ApiResult>('update', {
    profileId,
    patch: input,
  });
  if (!res.ok) throw new Error(toError(res, 'update_failed'));
  if (!res.profile) throw new Error('update_failed');
  return res.profile;
}

export async function setDefaultProfile(profileId: string): Promise<string> {
  const res = await req<ApiResult>('setDefault', { profileId });
  if (!res.ok) throw new Error(res.error || 'set_default_failed');
  return res.defaultFamilyProfileId || profileId;
}

export async function getProfile(profileId: string): Promise<ClientProfile> {
  const res = await req<ApiResult>('get', { profileId });
  if (!res.ok) throw new Error(res.error || 'get_failed');
  if (!res.profile) throw new Error('get_failed');
  return res.profile;
}

function toError(res: ApiResult, fallback: string): string {
  if (res.error === 'invalid_input') return `invalid_input:${res.message || ''}`;
  return res.error || fallback;
}
