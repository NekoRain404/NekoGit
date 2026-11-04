/// Unit tests for pull request review dismissal id and message validation.
import { describe, expect, test } from 'vitest';

import {
  normalizeReviewDismissalBody,
  normalizeReviewDismissalMessage,
  PR_REVIEW_DISMISSAL_MESSAGE_MAX_LENGTH,
  validateReviewDismissalId,
} from '../shared/utils/pr-review-dismiss';

function captureError(callback: () => unknown) {
  try {
    callback();
  } catch (error) {
    return error;
  }
  return undefined;
}

describe('review dismissal id validation', () => {
  test('accepts positive integer numbers and numeric strings', () => {
    expect(validateReviewDismissalId(1)).toBe(1);
    expect(validateReviewDismissalId(42)).toBe(42);
    expect(validateReviewDismissalId('1')).toBe(1);
    expect(validateReviewDismissalId('  123  ')).toBe(123);
    expect(validateReviewDismissalId(String(Number.MAX_SAFE_INTEGER))).toBe(
      Number.MAX_SAFE_INTEGER
    );
  });

  test('rejects non-positive, non-integer, and non-numeric ids', () => {
    for (const value of [
      0,
      -1,
      1.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.MAX_SAFE_INTEGER + 1,
      '',
      '   ',
      '0',
      '-1',
      '1.5',
      'abc',
      '1e3',
      null,
      undefined,
      true,
      {},
      [],
    ]) {
      expect(captureError(() => validateReviewDismissalId(value))).toMatchObject({
        statusCode: 400,
        statusMessage: 'review_id must be a positive integer',
      });
    }
  });
});

describe('review dismissal message normalization', () => {
  test('omits nullish and blank messages', () => {
    expect(normalizeReviewDismissalMessage(undefined)).toBeUndefined();
    expect(normalizeReviewDismissalMessage(null)).toBeUndefined();
    expect(normalizeReviewDismissalMessage('')).toBeUndefined();
    expect(normalizeReviewDismissalMessage('   ')).toBeUndefined();
  });

  test('trims accepted messages', () => {
    expect(normalizeReviewDismissalMessage('  Stale review  ')).toBe('Stale review');
  });

  test('accepts the maximum length and rejects longer messages', () => {
    const maxMessage = 'a'.repeat(PR_REVIEW_DISMISSAL_MESSAGE_MAX_LENGTH);

    expect(normalizeReviewDismissalMessage(maxMessage)).toBe(maxMessage);
    expect(
      captureError(() =>
        normalizeReviewDismissalMessage('a'.repeat(PR_REVIEW_DISMISSAL_MESSAGE_MAX_LENGTH + 1))
      )
    ).toMatchObject({
      statusCode: 400,
      statusMessage: `message must be at most ${PR_REVIEW_DISMISSAL_MESSAGE_MAX_LENGTH} characters`,
    });
  });

  test('rejects non-string messages', () => {
    for (const value of [42, true, {}, []]) {
      expect(captureError(() => normalizeReviewDismissalMessage(value))).toMatchObject({
        statusCode: 400,
        statusMessage: 'message must be a string',
      });
    }
  });
});

describe('review dismissal body normalization', () => {
  test('accepts missing bodies and optional messages', () => {
    expect(normalizeReviewDismissalBody(undefined)).toEqual({ message: undefined });
    expect(normalizeReviewDismissalBody(null)).toEqual({ message: undefined });
    expect(normalizeReviewDismissalBody({})).toEqual({ message: undefined });
    expect(normalizeReviewDismissalBody({ message: '  Stale review  ' })).toEqual({
      message: 'Stale review',
    });
  });

  test('rejects non-object bodies', () => {
    for (const body of ['message', 42, true, []]) {
      expect(captureError(() => normalizeReviewDismissalBody(body))).toMatchObject({
        statusCode: 400,
        statusMessage: 'Request body must be an object',
      });
    }
  });
});
