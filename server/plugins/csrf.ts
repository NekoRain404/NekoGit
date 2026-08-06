///  Plugins / Csrf - Seeds the CSRF double-submit cookie on safe requests when none is present.
import { randomBytes } from 'node:crypto';

import { getCookie, getRequestProtocol, setCookie } from 'h3';

import { shouldUseSecureCsrfCookie } from '../utils/csrf-cookie-utils';

const CSRF_COOKIE_NAME = 'nekogit_csrf';
const CSRF_TOKEN_BYTES = 32;

function generateCsrfToken(): string {
  return randomBytes(CSRF_TOKEN_BYTES).toString('base64url');
}

/** Seed a CSRF double-submit cookie on safe requests when one is not already present. */
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('request', (event) => {
    if (event.method !== 'GET' && event.method !== 'HEAD') {
      return;
    }

    const existing = getCookie(event, CSRF_COOKIE_NAME);

    if (existing) {
      return;
    }

    setCookie(event, CSRF_COOKIE_NAME, generateCsrfToken(), {
      httpOnly: false,
      sameSite: 'lax',
      secure: shouldUseSecureCsrfCookie(getRequestProtocol(event)),
      path: '/',
    });
  });
});
