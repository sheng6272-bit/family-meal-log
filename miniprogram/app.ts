/**
 * App entry point.
 * Responsibilities: initialize CloudBase (if configured) and hold minimal
 * global state. No AI, no business logic here.
 */
import { initCloud, isCloudReady } from './services/cloud';

App<IAppOption>({
  globalData: {
    openid: undefined,
    activeFamilyProfileId: undefined,
    cloudReady: false,
  },

  onLaunch() {
    const ready = initCloud();
    this.globalData.cloudReady = ready && isCloudReady();
    if (!this.globalData.cloudReady) {
      console.info('[app] Started in offline shell mode (manual logging available).');
    }
  },
});
