/// Returns the available authentication providers and their configuration.
import type { AuthProviderState } from '#shared/types/auth-provider';

import { resolveAuthProviderState } from '../../utils/auth-providers';

/** Return the current auth provider state and available authentication modes. */
export default defineEventHandler((): AuthProviderState => {
  return resolveAuthProviderState();
});
