/**
 * Session service: bootstrap identity + profiles, persist the active profile
 * id locally, and resolve which profile is active on launch.
 *
 * Only the profile id is stored on the device. Ownership credentials (openid)
 * are never persisted client-side.
 */

import { login } from './auth';
import { listProfiles } from './profile';
import type { ClientProfile } from './profile';

const ACTIVE_KEY = 'fml.activeProfileId';

export function getActiveProfileId(): string | undefined {
  try {
    return wx.getStorageSync(ACTIVE_KEY) || undefined;
  } catch {
    return undefined;
  }
}

export function setActiveProfileId(id: string): void {
  try {
    wx.setStorageSync(ACTIVE_KEY, id);
  } catch {
    /* storage failures are non-fatal on the client */
  }
}

/**
 * Client-side copy of the shared `resolveActiveProfile` priority:
 *   1. locally remembered active id still in the list
 *   2. server-side defaultFamilyProfileId
 *   3. first available profile
 *   4. undefined (onboarding)
 */
export function resolveActiveProfile(
  profiles: ClientProfile[],
  localActiveId: string | undefined,
  serverDefaultId: string | undefined,
): ClientProfile | undefined {
  if (profiles.length === 0) return undefined;
  if (localActiveId && profiles.some((p) => p._id === localActiveId)) {
    return profiles.find((p) => p._id === localActiveId);
  }
  if (serverDefaultId && profiles.some((p) => p._id === serverDefaultId)) {
    return profiles.find((p) => p._id === serverDefaultId);
  }
  return profiles[0];
}

export interface SessionResult {
  ok: boolean;
  reason?: string;
  userId?: string | null;
  defaultFamilyProfileId?: string | null;
  profiles?: ClientProfile[];
  activeId?: string | undefined;
}

/**
 * Bootstrap the session: login (server-derived identity) + load profiles +
 * resolve the active profile. Idempotent — safe to call from app.onLaunch and
 * page onShow. Updates globalData and persists the active id locally.
 */
export async function loadSession(app: IAppOption): Promise<SessionResult> {
  if (!app.globalData.cloudReady) {
    return { ok: false, reason: 'cloud_not_configured' };
  }
  try {
    const loginRes = await login();
    const profiles = await listProfiles();
    const active = resolveActiveProfile(
      profiles,
      getActiveProfileId(),
      loginRes.defaultFamilyProfileId ?? undefined,
    );
    const activeId = active ? active._id : undefined;
    if (activeId) setActiveProfileId(activeId);

    app.globalData.userId = loginRes.userId ?? undefined;
    app.globalData.defaultFamilyProfileId = loginRes.defaultFamilyProfileId ?? undefined;
    app.globalData.profiles = profiles;
    app.globalData.activeFamilyProfileId = activeId;
    app.globalData.sessionLoaded = true;
    return {
      ok: true,
      userId: loginRes.userId,
      defaultFamilyProfileId: loginRes.defaultFamilyProfileId,
      profiles,
      activeId,
    };
  } catch (e) {
    return { ok: false, reason: (e as Error).message || 'session_failed' };
  }
}

/** Select a profile as active for THIS session (local only). */
export function selectActiveProfile(app: IAppOption, profileId: string): void {
  setActiveProfileId(profileId);
  app.globalData.activeFamilyProfileId = profileId;
}
