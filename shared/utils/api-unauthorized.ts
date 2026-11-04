/// Helpers for reacting to unauthorized API responses without redirect loops.

/** Auth endpoints that must never trigger the global 401 handler. */
const AUTH_ROUTE_EXACT_PATHS = new Set(['/api/_auth', '/api/auth', '/auth']);

/** Auth endpoint prefixes that must never trigger the global 401 handler. */
const AUTH_ROUTE_PREFIXES = ['/api/_auth/', '/api/auth/', '/auth/'] as const;

type RequestLike = {
  url?: unknown;
  href?: unknown;
};

/** Resolve a request string, URL, or Request-like object to its URL path. */
export const resolveRequestPath = (request: unknown): string | null => {
  let rawUrl: string | null = null;

  if (typeof request === 'string') {
    rawUrl = request;
  } else if (request && typeof request === 'object') {
    const requestLike = request as RequestLike;
    if (typeof requestLike.url === 'string') {
      rawUrl = requestLike.url;
    } else if (typeof requestLike.href === 'string') {
      rawUrl = requestLike.href;
    }
  }

  if (!rawUrl) {
    return null;
  }

  try {
    return new URL(rawUrl, 'http://localhost').pathname;
  } catch {
    return null;
  }
};

/** Whether a path belongs to an authentication route. */
export const isAuthRoutePath = (path: string): boolean => {
  if (AUTH_ROUTE_EXACT_PATHS.has(path)) {
    return true;
  }

  return AUTH_ROUTE_PREFIXES.some((prefix) => path.startsWith(prefix));
};

/**
 * Whether a 401 from this request should clear the session and redirect.
 *
 * Only `/api/` requests are handled, and auth endpoints are explicitly
 * excluded so session refreshes and login flows cannot cause redirect loops.
 */
export const shouldHandleUnauthorizedRequest = (request: unknown): boolean => {
  const path = resolveRequestPath(request);
  if (!path || !path.startsWith('/api/') || isAuthRoutePath(path)) {
    return false;
  }

  return true;
};

/** Extract an HTTP status from an ofetch-style error object. */
export const getFetchResponseStatus = (error: unknown): number | null => {
  if (!error || typeof error !== 'object') {
    return null;
  }

  const response = (error as { response?: { status?: unknown } }).response;
  return typeof response?.status === 'number' ? response.status : null;
};

/** Options accepted by the shared unauthorized-response handler. */
export interface HandleUnauthorizedApiResponseOptions {
  request: unknown;
  redirect: () => unknown | Promise<unknown>;
  clearSession?: () => void | Promise<unknown>;
}

let isHandlingUnauthorizedResponse = false;

/** Reset the in-flight guard (test helper). */
export const resetUnauthorizedApiHandler = () => {
  isHandlingUnauthorizedResponse = false;
};

/**
 * Clear the session and redirect once for a burst of 401 responses.
 *
 * Returns whether this call performed the handling. Concurrent 401s and
 * non-API/auth requests are ignored.
 */
export const handleUnauthorizedApiResponse = async (
  options: HandleUnauthorizedApiResponseOptions
): Promise<boolean> => {
  if (isHandlingUnauthorizedResponse || !shouldHandleUnauthorizedRequest(options.request)) {
    return false;
  }

  isHandlingUnauthorizedResponse = true;

  try {
    if (options.clearSession) {
      try {
        await options.clearSession();
      } catch (error) {
        console.warn('Failed to clear the session after a 401 response.', error);
      }
    }

    try {
      await options.redirect();
    } catch (error) {
      console.warn('Failed to redirect after a 401 response.', error);
    }

    return true;
  } finally {
    isHandlingUnauthorizedResponse = false;
  }
};
