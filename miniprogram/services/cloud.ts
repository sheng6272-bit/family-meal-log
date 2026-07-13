/**
 * Thin wrapper around the WeChat CloudBase SDK.
 * Centralizes init so pages never touch wx.cloud directly, and so the app
 * degrades gracefully when no environment ID is configured yet.
 */
import { getActiveEnv, isCloudConfigured } from '../config/env';

let initialized = false;

export function initCloud(): boolean {
  if (initialized) return true;
  if (!wx.cloud) {
    console.warn('[cloud] wx.cloud is unavailable. Update the base library version.');
    return false;
  }
  if (!isCloudConfigured()) {
    console.warn(
      '[cloud] No CloudBase env ID configured. Running in offline shell mode. ' +
        'See miniprogram/config/env.local.example.ts.',
    );
    return false;
  }
  const env = getActiveEnv();
  wx.cloud.init({ env: env.cloudEnvId, traceUser: true });
  initialized = true;
  return true;
}

export function isCloudReady(): boolean {
  return initialized;
}

/**
 * Call a cloud function by name. Throws if cloud is not ready so callers can
 * fall back to the local/manual workflow.
 */
export async function callFunction<T = unknown>(
  name: string,
  data: Record<string, unknown> = {},
): Promise<T> {
  if (!isCloudReady()) {
    throw new Error(`[cloud] callFunction(${name}) skipped: cloud not initialized`);
  }
  const res = await wx.cloud.callFunction({ name, data });
  return res.result as T;
}
