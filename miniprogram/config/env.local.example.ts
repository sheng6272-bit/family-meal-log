/**
 * TEMPLATE for local environment overrides.
 *
 * 1. Copy this file to `env.local.ts` (which is git-ignored).
 * 2. Fill in your real CloudBase environment IDs.
 * 3. In `app.ts`, call `applyEnvOverrides(LOCAL_ENV_OVERRIDES)` before cloud init.
 *
 * NEVER commit `env.local.ts`. NEVER put AI secrets here (they belong in the
 * CloudBase cloud-function environment, not the client).
 */
import type { AppEnvName, EnvConfig } from './env';

export const LOCAL_ENV_OVERRIDES: Partial<Record<AppEnvName, Partial<EnvConfig>>> = {
  dev: { cloudEnvId: 'your-dev-env-id' },
  prod: { cloudEnvId: 'your-prod-env-id' },
};
