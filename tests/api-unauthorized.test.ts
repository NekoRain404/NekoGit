/// Unit tests for the shared 401 handling helpers.
import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
  getFetchResponseStatus,
  handleUnauthorizedApiResponse,
  isAuthRoutePath,
  resetUnauthorizedApiHandler,
  resolveRequestPath,
  shouldHandleUnauthorizedRequest,
} from '../shared/utils/api-unauthorized';

describe('API 401 handling helpers', () => {
  beforeEach(() => {
    resetUnauthorizedApiHandler();
  });

  test('resolves request paths from strings, URLs, and Request objects', () => {
    expect(resolveRequestPath('/api/issues?page=1')).toBe('/api/issues');
    expect(resolveRequestPath(new URL('https://example.com/api/pulls'))).toBe('/api/pulls');
    expect(resolveRequestPath(new Request('https://example.com/api/repos'))).toBe('/api/repos');
    expect(resolveRequestPath(undefined)).toBeNull();
  });

  test('only handles API requests and skips auth routes', () => {
    expect(shouldHandleUnauthorizedRequest('/api/issues')).toBe(true);
    expect(shouldHandleUnauthorizedRequest('https://example.com/api/pulls?state=all')).toBe(true);
    expect(shouldHandleUnauthorizedRequest('/dashboard')).toBe(false);
    expect(shouldHandleUnauthorizedRequest('/api/auth/providers')).toBe(false);
    expect(shouldHandleUnauthorizedRequest('/api/_auth/session')).toBe(false);
    expect(shouldHandleUnauthorizedRequest('/auth/github')).toBe(false);
    expect(shouldHandleUnauthorizedRequest(null)).toBe(false);
  });

  test('recognizes auth route paths with and without a trailing segment', () => {
    expect(isAuthRoutePath('/api/auth')).toBe(true);
    expect(isAuthRoutePath('/api/auth/providers')).toBe(true);
    expect(isAuthRoutePath('/api/_auth/session')).toBe(true);
    expect(isAuthRoutePath('/auth/logout')).toBe(true);
    expect(isAuthRoutePath('/api/authenticated')).toBe(false);
  });

  test('extracts response status from ofetch-style errors', () => {
    expect(getFetchResponseStatus({ response: { status: 401 } })).toBe(401);
    expect(getFetchResponseStatus({ response: { status: '401' } })).toBeNull();
    expect(getFetchResponseStatus(new Error('boom'))).toBeNull();
    expect(getFetchResponseStatus(null)).toBeNull();
  });

  test('clears the session and redirects once for concurrent 401s', async () => {
    const clearSession = vi.fn().mockResolvedValue(undefined);
    const redirect = vi.fn().mockResolvedValue(undefined);

    const first = handleUnauthorizedApiResponse({
      request: '/api/issues',
      clearSession,
      redirect,
    });
    const second = handleUnauthorizedApiResponse({
      request: '/api/pulls',
      clearSession,
      redirect,
    });

    await expect(Promise.all([first, second])).resolves.toEqual([true, false]);
    expect(clearSession).toHaveBeenCalledTimes(1);
    expect(redirect).toHaveBeenCalledTimes(1);
  });

  test('ignores non-API and auth requests', async () => {
    const clearSession = vi.fn();
    const redirect = vi.fn();

    await expect(
      handleUnauthorizedApiResponse({ request: '/api/auth/providers', clearSession, redirect })
    ).resolves.toBe(false);
    await expect(
      handleUnauthorizedApiResponse({ request: '/dashboard', clearSession, redirect })
    ).resolves.toBe(false);

    expect(clearSession).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  test('still redirects when clearing the session fails', async () => {
    const redirect = vi.fn().mockResolvedValue(undefined);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(
      handleUnauthorizedApiResponse({
        request: '/api/issues',
        clearSession: () => Promise.reject(new Error('clear failed')),
        redirect,
      })
    ).resolves.toBe(true);

    expect(redirect).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  test('can handle a later 401 after the first burst completes', async () => {
    const redirect = vi.fn().mockResolvedValue(undefined);

    await handleUnauthorizedApiResponse({ request: '/api/issues', redirect });
    await handleUnauthorizedApiResponse({ request: '/api/pulls', redirect });

    expect(redirect).toHaveBeenCalledTimes(2);
  });
});
