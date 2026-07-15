/**
 * App entry point (M1).
 *
 * Responsibilities: initialize CloudBase (if configured) and bootstrap the
 * session (server-derived identity + profile list + active-profile
 * resolution). No openid is ever stored or trusted from the client.
 */
import { applyEnvOverrides } from './config/env';
import { initCloud, isCloudReady } from './services/cloud';
import { loadSession } from './services/session';

function loadLocalEnvOverrides() {
  try {
    const local = require('./config/env.local') as {
      LOCAL_ENV_OVERRIDES?: Parameters<typeof applyEnvOverrides>[0];
    };
    return local.LOCAL_ENV_OVERRIDES ?? {};
  } catch {
    return {};
  }
}

App<IAppOption>({
  globalData: {
    cloudReady: false,
    userId: undefined,
    defaultFamilyProfileId: undefined,
    profiles: [],
    activeFamilyProfileId: undefined,
    sessionLoaded: false,
  },

  onLaunch() {
    // Load git-ignored local overrides when present; otherwise stay in the
    // documented offline shell mode for a clean checkout.
    applyEnvOverrides(loadLocalEnvOverrides());

    const ready = initCloud();
    this.globalData.cloudReady = ready && isCloudReady();

    if (this.globalData.cloudReady) {
      // Bootstrap identity + profiles. Pages also call loadSession on show,
      // so this is best-effort warm-up; failures are handled per-page.
      loadSession(this as IAppOption).catch((e) => {
        console.error('[app] session bootstrap failed', e);
      });
    } else {
      console.info('[app] Offline shell mode (cloud not configured).');
    }
  },
});
