/// GET Desktop readiness probe (loopback). Challenge-response HMAC; token never leaves the process.

import {
  buildDesktopReadinessProof,
  isValidReadinessChallenge,
} from '../../../shared/utils/desktop-readiness';

const READINESS_ENV = 'NEKOGIT_DESKTOP_READINESS_TOKEN';

/**
 * Desktop-only health endpoint. Returns 200 + HMAC proof only when the process has
 * a readiness token and the client supplies a valid challenge. The shared secret
 * is never accepted from or returned to the client (prevents forgeable 200s).
 */
export default defineEventHandler((event) => {
  const expected = process.env[READINESS_ENV]?.trim() ?? '';
  if (!expected) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
    });
  }

  const query = getQuery(event);
  const challengeRaw = Array.isArray(query.challenge) ? query.challenge[0] : query.challenge;
  const challenge = typeof challengeRaw === 'string' ? challengeRaw.trim() : '';

  if (!isValidReadinessChallenge(challenge)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid readiness challenge',
    });
  }

  const proof = buildDesktopReadinessProof(expected, challenge);

  setHeader(event, 'cache-control', 'no-store');
  setHeader(event, 'content-type', 'application/json; charset=utf-8');
  return {
    ok: true,
    service: 'nekogit-desktop',
    proof,
  };
});
