import { createHmac } from 'node:crypto';

import { describe, expect, test } from 'vitest';

import {
  buildDesktopReadinessProof,
  DESKTOP_READINESS_PROOF_DOMAIN,
  isValidReadinessChallenge,
  readinessProofEquals,
} from '../shared/utils/desktop-readiness';

describe('desktop readiness proof', () => {
  test('matches independent HMAC-SHA256 with the domain separator', () => {
    const token = 'a'.repeat(64);
    const challenge = 'deadbeefdeadbeefdeadbeefdeadbeef';
    const expected = createHmac('sha256', token)
      .update(`${DESKTOP_READINESS_PROOF_DOMAIN}${challenge}`)
      .digest('hex');

    expect(buildDesktopReadinessProof(token, challenge)).toBe(expected);
  });

  test('different challenges produce different proofs', () => {
    const token = 'b'.repeat(64);
    const a = buildDesktopReadinessProof(token, '1111111111111111');
    const b = buildDesktopReadinessProof(token, '2222222222222222');
    expect(a).not.toBe(b);
  });

  test('proof equality is length-safe', () => {
    const proof = buildDesktopReadinessProof('token-value-here!!', '0123456789abcdef');
    expect(readinessProofEquals(proof, proof)).toBe(true);
    expect(readinessProofEquals(proof, proof.slice(0, -1) + '0')).toBe(false);
    expect(readinessProofEquals('', '')).toBe(false);
  });

  test('challenge validation requires non-empty hex of sufficient length', () => {
    expect(isValidReadinessChallenge('0123456789abcdef')).toBe(true);
    expect(isValidReadinessChallenge('short')).toBe(false);
    expect(isValidReadinessChallenge('')).toBe(false);
    expect(isValidReadinessChallenge('zzzzzzzzzzzzzzzz')).toBe(false);
  });
});
