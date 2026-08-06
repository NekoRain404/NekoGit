/// HMAC-based readiness proofs for verifying the desktop client companion.
import { createHmac, timingSafeEqual } from 'node:crypto';

/** Domain separation for the desktop readiness HMAC proof. */
export const DESKTOP_READINESS_PROOF_DOMAIN = 'nekogit-desktop-readiness-v1|';

/**
 * Build a readiness proof that only a process holding `token` can produce for `challenge`.
 * The challenge is public; the token never appears on the wire in either direction.
 */
export function buildDesktopReadinessProof(token: string, challenge: string): string {
  return createHmac('sha256', token)
    .update(`${DESKTOP_READINESS_PROOF_DOMAIN}${challenge}`)
    .digest('hex');
}

/** Constant-time compare of readiness proofs (hex strings). */
export function readinessProofEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, 'utf8');
  const rightBuffer = Buffer.from(right, 'utf8');
  if (leftBuffer.length !== rightBuffer.length || leftBuffer.length === 0) {
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
}

/** Validate a challenge string from the desktop probe (non-empty hex). */
export function isValidReadinessChallenge(challenge: string): boolean {
  return /^[0-9a-fA-F]{16,128}$/.test(challenge);
}
