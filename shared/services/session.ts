/**
 * Active-profile resolution. Pure logic, shared by the client and the tests.
 *
 * On app start, the active profile is chosen by priority:
 *   1. A locally remembered active id that still belongs to the returned list.
 *   2. The server-side defaultFamilyProfileId.
 *   3. The first available profile (list is createdAt ascending).
 *   4. undefined  -> caller shows first-profile onboarding.
 *
 * Only the profile id is ever remembered locally; ownership credentials are
 * never stored on the device.
 */

import type { ClientProfile } from './profile-service';

export function resolveActiveProfile(
  profiles: ClientProfile[],
  localActiveId: string | null | undefined,
  serverDefaultId: string | null | undefined,
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
