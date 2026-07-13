/**
 * Environment configuration (client side).
 *
 * SECURITY: This file MUST NOT contain real CloudBase environment IDs or any
 * secret. The IDs below are intentionally EMPTY placeholders. A developer sets
 * them locally (see `env.local.example.ts`) or a CI step injects them at build
 * time. AI provider secrets NEVER live on the client - they stay in the
 * CloudBase cloud-function environment variables.
 */

export type AppEnvName = 'dev' | 'prod';

export interface EnvConfig {
  /** Active environment name. Flip to 'prod' for production builds. */
  name: AppEnvName;
  /** CloudBase environment ID. Empty until configured locally / by CI. */
  cloudEnvId: string;
  /** Enables verbose logging in development only. */
  debug: boolean;
}

/**
 * Per-environment defaults. IDs are blank on purpose - fill them in a
 * git-ignored `env.local.ts` (copy from `env.local.example.ts`) and import it,
 * or inject via your build pipeline. Do NOT commit real IDs here.
 */
const ENVIRONMENTS: Record<AppEnvName, EnvConfig> = {
  dev: { name: 'dev', cloudEnvId: '', debug: true },
  prod: { name: 'prod', cloudEnvId: '', debug: false },
};

/** Change this (or override via build tooling) to select the active target. */
const ACTIVE_ENV: AppEnvName = 'dev';

let overrides: Partial<Record<AppEnvName, Partial<EnvConfig>>> = {};

/**
 * Optional runtime override hook. A git-ignored bootstrap (or build step) can
 * call this once at startup to inject the local CloudBase env ID without ever
 * hardcoding it in committed source.
 */
export function applyEnvOverrides(
  next: Partial<Record<AppEnvName, Partial<EnvConfig>>>,
): void {
  overrides = next;
}

export function getActiveEnv(): EnvConfig {
  const base = ENVIRONMENTS[ACTIVE_ENV];
  const override = overrides[ACTIVE_ENV] ?? {};
  return { ...base, ...override };
}

export function isCloudConfigured(): boolean {
  return getActiveEnv().cloudEnvId.trim().length > 0;
}
