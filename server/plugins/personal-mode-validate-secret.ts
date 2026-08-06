///  Plugins / Personal Mode Validate Secret - Checks personal-mode secret strength at startup and warns on deprecated env vars.
import { resolveAuthProviderState } from '../utils/auth-providers';
import {
  assertPersonalCookieSecretStrength,
  assertPersonalPasswordConfigStrength,
} from '../utils/personal-mode-utils';

/** Validate personal-mode secret strength at startup and warn on deprecated env vars. */
export default defineNitroPlugin(() => {
  if (import.meta.prerender) {
    return;
  }

  if (
    process.env.AUTH_PERSONAL_TOKEN ||
    process.env.AUTH_PERSONAL_PASSWORD ||
    process.env.AUTH_PERSONAL_COOKIE_SECRET
  ) {
    console.warn(
      '[auth] BREAKING: AUTH_PERSONAL_TOKEN/PASSWORD/COOKIE_SECRET are no longer read. Rename to NUXT_GIT_PULSE_AUTH_GITHUB_TOKEN/PASSWORD/COOKIE_SECRET. See CHANGELOG.'
    );
  }

  const providerState = resolveAuthProviderState();

  if (!providerState.personalMode) {
    return;
  }

  assertPersonalCookieSecretStrength();
  assertPersonalPasswordConfigStrength();
});
