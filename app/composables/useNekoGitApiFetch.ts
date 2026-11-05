/// ofetch wrapper that automatically attaches the CSRF token to non-safe HTTP requests.
import type { FetchOptions } from 'ofetch';

import {
  getFetchResponseStatus,
  handleUnauthorizedApiResponse,
} from '#shared/utils/api-unauthorized';

const CSRF_COOKIE_NAME = 'nekogit_csrf';
const CSRF_HEADER_NAME = 'X-CSRF-Token';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Uppercase and default an HTTP method string. */
const normalizeMethod = (method: unknown) => {
  return typeof method === 'string' ? method.toUpperCase() : 'GET';
};

type NekoGitApiFetch = <T = unknown>(request: string, options?: FetchOptions<'json'>) => Promise<T>;

/** Create an ofetch wrapper that automatically attaches the CSRF token to unsafe requests. */
export function useNekoGitApiFetch() {
  const requestFetch = useRequestFetch() as unknown as NekoGitApiFetch;
  const { clear: clearSession } = useUserSession();
  const csrfCookie = useCookie<string | null | undefined>(CSRF_COOKIE_NAME, {
    readonly: true,
  });

  const apiFetch: NekoGitApiFetch = async <T = unknown>(
    request: string,
    options: FetchOptions<'json'> = {}
  ) => {
    const nextOptions: FetchOptions<'json'> = { ...options };
    const method = normalizeMethod(nextOptions.method);

    if (!SAFE_METHODS.has(method)) {
      const token = csrfCookie.value;
      if (token) {
        const headers = new Headers(nextOptions.headers as HeadersInit | undefined);
        headers.set(CSRF_HEADER_NAME, token);
        nextOptions.headers = headers;
      }
    }

    try {
      return await requestFetch<T>(request, nextOptions);
    } catch (error) {
      if (import.meta.client && getFetchResponseStatus(error) === 401) {
        void handleUnauthorizedApiResponse({
          request,
          clearSession,
          redirect: () => navigateTo('/', { replace: true }),
        });
      }

      throw error;
    }
  };

  return apiFetch;
}
