/**
 * App entry point (M1).
 *
 * Responsibilities: initialize CloudBase (if configured) and bootstrap the
 * session (server-derived identity + profile list + active-profile
 * resolution). No openid is ever stored or trusted from the client.
 */
import { initCloud, isCloudReady } from './services/cloud';
import { loadSession } from './services/session';

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
