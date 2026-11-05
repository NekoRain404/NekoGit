///  Middleware / Security Headers - Sets baseline browser security headers on non-static responses.
import { setResponseHeaders } from 'h3';

import { resolveSecurityHeaders } from '#shared/utils/security-headers';

export default defineEventHandler((event) => {
  const [pathname = ''] = (event.path ?? '').split('?');
  const headers = resolveSecurityHeaders(pathname);

  if (!headers) {
    return;
  }

  setResponseHeaders(event, headers);
});
