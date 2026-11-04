/// Resolves a proxy URL from standard HTTP(S) environment variables as fallback.
import { normalizeProxyUrl } from './user-settings';

/**
 * Resolve proxy URL from environment (HTTPS_PROXY / HTTP_PROXY / ALL_PROXY).
 * Used as fallback when user settings do not enable a proxy.
 */
export function resolveEnvProxyUrl(env: Record<string, string | undefined> = process.env): string {
  return (
    normalizeProxyUrl(env.HTTPS_PROXY) ||
    normalizeProxyUrl(env.https_proxy) ||
    normalizeProxyUrl(env.HTTP_PROXY) ||
    normalizeProxyUrl(env.http_proxy) ||
    normalizeProxyUrl(env.ALL_PROXY) ||
    normalizeProxyUrl(env.all_proxy) ||
    ''
  );
}
