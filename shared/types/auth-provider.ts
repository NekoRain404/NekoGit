/// Auth provider mode and state types for authentication configuration.
/** Auth Provider Mode. */
export type AuthProviderMode = 'personal' | 'pat-only' | 'oauth-only' | 'hybrid';

/** Auth Provider State. */
export interface AuthProviderState {
  personalMode: boolean;
  patEnabled: boolean;
  oauthEnabled: boolean;
  oauthRequested: boolean;
  oauthEnvReady: boolean;
  hasAvailableProvider: boolean;
  mode: AuthProviderMode;
  warnings: string[];
}
