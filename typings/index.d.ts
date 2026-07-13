/**
 * Ambient project typings.
 */

interface IAppGlobalData {
  /** Openid of the signed-in user, resolved server-side after login. */
  openid?: string;
  /** Currently selected family profile id. */
  activeFamilyProfileId?: string;
  /** Whether the CloudBase environment is configured and initialized. */
  cloudReady: boolean;
}

interface IAppOption {
  globalData: IAppGlobalData;
}
