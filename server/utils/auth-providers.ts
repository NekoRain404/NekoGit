///  Utils / Auth Providers - Resolves the enabled authentication mode (personal/pat/oauth/hybrid) from runtime config and env.
import type { AuthProviderMode, AuthProviderState } from '#shared/types/auth-provider';

import { resolvePersonalModeSecrets } from '../../shared/utils/personal-mode-env';

const ENABLED_VALUES = new Set(['1', 'true', 'yes', 'on']);
const DISABLED_VALUES = new Set(['0', 'false', 'no', 'off']);

/** Error thrown when no authentication provider is enabled at startup. */
export const AUTH_PROVIDER_CONFIGURATION_ERROR =
  'NekoGit auth configuration is invalid: both token input and GitHub OAuth are disabled. Enable NUXT_AUTH_PAT_ENABLED or NUXT_AUTH_GITHUB_OAUTH_ENABLED before starting the app.';

/** Error thrown when personal mode is enabled but required credentials are missing. */
export const AUTH_PERSONAL_MODE_CONFIGURATION_ERROR =
  'NekoGit auth configuration is invalid: personal mode requires non-empty NUXT_GIT_PULSE_AUTH_GITHUB_TOKEN, NUXT_GIT_PULSE_AUTH_PERSONAL_PASSWORD, and NUXT_GIT_PULSE_AUTH_PERSONAL_COOKIE_SECRET (formerly AUTH_PERSONAL_TOKEN, AUTH_PERSONAL_PASSWORD, AUTH_PERSONAL_COOKIE_SECRET) values before starting the app.';

/**
 * Normalize a loose boolean-like value (string, boolean, etc.) into a strict boolean.
 * Falls back to `defaultValue` when the input is not a recognized truthy/falsy value.
 */
function normalizeBoolean(value: unknown, defaultValue: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (ENABLED_VALUES.has(normalized)) return true;
    if (DISABLED_VALUES.has(normalized)) return false;
  }

  return defaultValue;
}

/** Check whether a value is a non-blank string. */
function hasNonBlankString(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Normalize optional secret fields from runtimeConfig. */
function normalizeSecretString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Resolve the composite auth provider mode from individual feature flags. */
function resolveMode(
  personalMode: boolean,
  tokenEnabled: boolean,
  oauthEnabled: boolean
): AuthProviderMode {
  if (personalMode) return 'personal';
  if (tokenEnabled && oauthEnabled) return 'hybrid';
  if (oauthEnabled) return 'oauth-only';
  return 'pat-only';
}

/**
 * Read Nuxt runtime config and resolve the current auth provider state,
 * including which authentication modes are active and any configuration warnings.
 */
export function resolveAuthProviderState(): AuthProviderState {
  const runtimeConfig = useRuntimeConfig() as {
    nekoGitAuth?: {
      personalModeEnabled?: string | boolean;
      tokenEnabled?: string | boolean;
      githubOAuthEnabled?: string | boolean;
      githubOAuthRequested?: string | boolean;
      githubOAuthEnvReady?: string | boolean;
      githubToken?: string;
      personalPassword?: string;
      personalCookieSecret?: string;
    };
  };
  const personalMode = normalizeBoolean(runtimeConfig.nekoGitAuth?.personalModeEnabled, false);
  const tokenEnabled = normalizeBoolean(runtimeConfig.nekoGitAuth?.tokenEnabled, true);
  const oauthRequested = normalizeBoolean(runtimeConfig.nekoGitAuth?.githubOAuthRequested, false);
  const oauthEnvReady = normalizeBoolean(runtimeConfig.nekoGitAuth?.githubOAuthEnvReady, false);
  const oauthEnabled = normalizeBoolean(runtimeConfig.nekoGitAuth?.githubOAuthEnabled, false);
  const warnings: string[] = [];
  // Prefer live env so process-start secrets work even when runtimeConfig was baked empty.
  const personalSecrets = resolvePersonalModeSecrets(process.env);
  const githubToken =
    personalSecrets.githubToken || normalizeSecretString(runtimeConfig.nekoGitAuth?.githubToken);
  const personalPassword =
    personalSecrets.personalPassword ||
    normalizeSecretString(runtimeConfig.nekoGitAuth?.personalPassword);
  const personalCookieSecret =
    personalSecrets.personalCookieSecret ||
    normalizeSecretString(runtimeConfig.nekoGitAuth?.personalCookieSecret);

  if (
    personalMode &&
    (!hasNonBlankString(githubToken) ||
      !hasNonBlankString(personalPassword) ||
      !hasNonBlankString(personalCookieSecret))
  ) {
    throw new Error(AUTH_PERSONAL_MODE_CONFIGURATION_ERROR);
  }

  if (oauthRequested && !oauthEnvReady) {
    warnings.push(
      'GitHub OAuth is enabled by configuration, but NUXT_OAUTH_GITHUB_CLIENT_ID or NUXT_OAUTH_GITHUB_CLIENT_SECRET is missing. OAuth has been disabled for this runtime.'
    );
  }

  return {
    personalMode,
    patEnabled: tokenEnabled,
    oauthEnabled: personalMode ? false : oauthEnabled,
    oauthRequested: personalMode ? false : oauthRequested,
    oauthEnvReady,
    hasAvailableProvider: personalMode ? false : tokenEnabled || oauthEnabled,
    mode: resolveMode(personalMode, tokenEnabled, oauthEnabled),
    warnings,
  };
}

/**
 * Resolve auth provider state and throw if no provider is available.
 * Returns the state unchanged when at least one auth mode is active.
 */
export function assertAuthProviderState(): AuthProviderState {
  const providerState = resolveAuthProviderState();

  if (providerState.personalMode) {
    return providerState;
  }

  if (!providerState.hasAvailableProvider) {
    throw new Error(AUTH_PROVIDER_CONFIGURATION_ERROR);
  }

  return providerState;
}
