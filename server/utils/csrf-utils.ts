///  Utils / Csrf Utils - Validates the CSRF double-submit token and Origin/Referer host on state-changing requests.
import type { H3Event } from 'h3';
import { getCookie, getHeader, getRequestHost } from 'h3';

import { evaluateCsrfProtection } from '../../shared/utils/csrf-protection';

const CSRF_COOKIE_NAME = 'nekogit_csrf';
const CSRF_HEADER_NAME = 'x-csrf-token';

/**
 * Validate a CSRF token by comparing the header and cookie values
 * using constant-time comparison, then verifying the Origin/Referer
 * host matches the request host. Missing Origin and Referer fails closed.
 */
export function assertCsrfToken(event: H3Event, pathname: string): void {
  const method = (event.method ?? 'GET').toUpperCase();
  const headerToken = getHeader(event, CSRF_HEADER_NAME) ?? '';
  const cookieToken = getCookie(event, CSRF_COOKIE_NAME) ?? '';
  const origin = getHeader(event, 'origin') ?? '';
  const referer = getHeader(event, 'referer') ?? '';
  const originSource = origin || referer;
  const requestHost = getRequestHost(event);

  const decision = evaluateCsrfProtection({
    headerToken,
    cookieToken,
    originOrReferer: originSource,
    requestHost,
  });

  if (decision.ok) {
    return;
  }

  const reasonLabel =
    decision.reason === 'token'
      ? 'token mismatch'
      : decision.reason === 'missing_origin'
        ? 'missing origin/referer'
        : 'origin mismatch';
  console.warn(`[csrf] ${reasonLabel} on ${method} ${pathname}`);
  throw createError({
    statusCode: 403,
    statusMessage: 'csrf_mismatch',
  });
}
