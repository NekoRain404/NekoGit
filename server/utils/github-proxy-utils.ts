///  Utils / Github Proxy Utils - Resolves proxy settings and builds fetch implementations that route GitHub API traffic through an HTTP(S) proxy.
import type { H3Event } from 'h3';
import { EnvHttpProxyAgent, RetryAgent, fetch as undiciFetch, type Dispatcher } from 'undici';

import { resolveEnvProxyUrl } from '../../shared/utils/proxy-url';
import { normalizeProxyUrl } from '../../shared/utils/user-settings';
import { readUserSettings, getUserSettingsLogin } from './user-settings-utils';

/** Cache agents by proxy URL (bounded to avoid unbounded memory growth). */
const proxyAgentCache = new Map<string, Dispatcher>();
const PROXY_AGENT_CACHE_MAX_ENTRIES = 32;

/** Connect / tunnel timeouts for flaky Clash-style local proxies. */
const PROXY_CONNECT_TIMEOUT_MS = 60_000;
const PROXY_HEADERS_TIMEOUT_MS = 60_000;
const PROXY_BODY_TIMEOUT_MS = 60_000;

/** Retry transient network failures through the local proxy. */
const PROXY_MAX_RETRIES = 3;
const PROXY_RETRY_MIN_TIMEOUT_MS = 400;
const PROXY_RETRY_MAX_TIMEOUT_MS = 4_000;

type ProxiedFetch = typeof globalThis.fetch;

/**
 * Resolve the effective proxy URL for GitHub API traffic for this request.
 * Prefer the authenticated user's network settings; fall back to process env.
 */
export async function resolveGitHubProxyUrl(event?: H3Event): Promise<string> {
  if (event) {
    try {
      const login = await getUserSettingsLogin(event);
      const settings = await readUserSettings(login);
      if (settings.network.proxyEnabled && settings.network.proxyUrl) {
        return settings.network.proxyUrl;
      }
    } catch {
      // Not logged in or settings unavailable — use env fallback.
    }
  }

  return resolveEnvProxyUrl();
}

function destroyProxyAgent(agent: Dispatcher): void {
  // Evicted agents may still have pooled sockets; close them gracefully and ignore
  // errors caused by sockets that already exited.
  void agent.close().catch(() => {});
}

function enforceProxyAgentCacheLimit(): void {
  while (proxyAgentCache.size > PROXY_AGENT_CACHE_MAX_ENTRIES) {
    const oldestEntry = proxyAgentCache.entries().next().value;
    if (!oldestEntry) {
      return;
    }

    const [oldestProxyUrl, oldestAgent] = oldestEntry;
    proxyAgentCache.delete(oldestProxyUrl);
    destroyProxyAgent(oldestAgent);
  }
}

function getProxyAgent(proxyUrl: string): Dispatcher {
  const existing = proxyAgentCache.get(proxyUrl);
  if (existing) {
    // Refresh insertion order for LRU-style eviction.
    proxyAgentCache.delete(proxyUrl);
    proxyAgentCache.set(proxyUrl, existing);
    return existing;
  }

  // EnvHttpProxyAgent tunnels HTTPS via HTTP CONNECT (Clash/V2Ray mixed ports).
  // Use connectTimeout (not connect.timeout) — undici defaults to 10s otherwise.
  const baseAgent = new EnvHttpProxyAgent({
    httpProxy: proxyUrl,
    httpsProxy: proxyUrl,
    connectTimeout: PROXY_CONNECT_TIMEOUT_MS,
    headersTimeout: PROXY_HEADERS_TIMEOUT_MS,
    bodyTimeout: PROXY_BODY_TIMEOUT_MS,
  });

  const agent = new RetryAgent(baseAgent, {
    maxRetries: PROXY_MAX_RETRIES,
    minTimeout: PROXY_RETRY_MIN_TIMEOUT_MS,
    maxTimeout: PROXY_RETRY_MAX_TIMEOUT_MS,
    // Retry network-layer failures (connect timeout, socket hangups).
    // Status codes default includes 429/5xx for HTTP responses that reach us.
  });

  proxyAgentCache.set(proxyUrl, agent);
  enforceProxyAgentCacheLimit();
  return agent;
}

/**
 * Build a fetch implementation that routes through the given HTTP(S) proxy.
 * Returns undefined when proxyUrl is empty so callers can use the default fetch.
 */
export function createProxiedFetch(proxyUrl: string): ProxiedFetch | undefined {
  const normalized = normalizeProxyUrl(proxyUrl);
  if (!normalized) {
    return undefined;
  }

  const agent = getProxyAgent(normalized);

  const proxiedFetch: ProxiedFetch = (input, init) => {
    return undiciFetch(input as Parameters<typeof undiciFetch>[0], {
      ...(init as object),
      dispatcher: agent,
    }) as unknown as ReturnType<ProxiedFetch>;
  };

  return proxiedFetch;
}
