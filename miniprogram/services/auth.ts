/**
 * Auth service. Wraps the `login` cloud function.
 *
 * The client NEVER handles openid. Identity is resolved server-side; we only
 * receive a non-sensitive internal user id and the server-side default profile
 * id. On failure we surface a concise reason the UI can translate to Chinese.
 */

import { isCloudReady, callFunction } from './cloud';

export interface LoginResult {
  userId: string | null;
  defaultFamilyProfileId: string | null;
  isNewUser: boolean;
}

interface LoginResponse {
  ok: boolean;
  user?: { id: string | null; defaultFamilyProfileId: string | null };
  isNewUser?: boolean;
  error?: string;
}

export async function login(): Promise<LoginResult> {
  if (!isCloudReady()) throw new Error('cloud_not_ready');
  const res = await callFunction<LoginResponse>('login', {});
  if (!res.ok || !res.user) {
    throw new Error(res.error || 'login_failed');
  }
  return {
    userId: res.user.id || null,
    defaultFamilyProfileId: res.user.defaultFamilyProfileId || null,
    isNewUser: !!res.isNewUser,
  };
}
