/// Unit tests for discussion action body normalization.
import { describe, expect, test } from 'vitest';

import {
  isDiscussionLockReason,
  normalizeDiscussionAnswerAction,
  normalizeDiscussionLockAction,
  normalizeDiscussionUpvoteAction,
} from '../shared/utils/discussion-actions';

function captureError(callback: () => unknown) {
  try {
    callback();
  } catch (error) {
    return error;
  }
  return undefined;
}

describe('discussion answer and upvote normalization', () => {
  test('accepts boolean answered and upvoted values', () => {
    expect(normalizeDiscussionAnswerAction({ answered: true })).toBe(true);
    expect(normalizeDiscussionAnswerAction({ answered: false })).toBe(false);
    expect(normalizeDiscussionUpvoteAction({ upvoted: true })).toBe(true);
    expect(normalizeDiscussionUpvoteAction({ upvoted: false })).toBe(false);
  });

  test('rejects missing, non-boolean, and non-object bodies', () => {
    for (const body of [undefined, null, {}, 'true', 42, []]) {
      expect(captureError(() => normalizeDiscussionAnswerAction(body))).toMatchObject({
        statusCode: 400,
      });
      expect(captureError(() => normalizeDiscussionUpvoteAction(body))).toMatchObject({
        statusCode: 400,
      });
    }

    expect(captureError(() => normalizeDiscussionAnswerAction({ answered: 'yes' }))).toMatchObject({
      statusCode: 400,
      statusMessage: 'answered must be a boolean',
    });
    expect(captureError(() => normalizeDiscussionUpvoteAction({ upvoted: 1 }))).toMatchObject({
      statusCode: 400,
      statusMessage: 'upvoted must be a boolean',
    });
  });
});

describe('discussion lock normalization', () => {
  test('accepts lock actions with and without a reason', () => {
    expect(normalizeDiscussionLockAction({ locked: true })).toEqual({ locked: true });
    expect(normalizeDiscussionLockAction({ locked: false })).toEqual({ locked: false });
    expect(normalizeDiscussionLockAction({ locked: true, reason: 'off-topic' })).toEqual({
      locked: true,
      reason: 'off-topic',
    });
    expect(normalizeDiscussionLockAction({ locked: true, reason: 'too-heated' })).toEqual({
      locked: true,
      reason: 'too-heated',
    });
    expect(normalizeDiscussionLockAction({ locked: true, reason: 'resolved' })).toEqual({
      locked: true,
      reason: 'resolved',
    });
    expect(normalizeDiscussionLockAction({ locked: true, reason: 'spam' })).toEqual({
      locked: true,
      reason: 'spam',
    });
  });

  test('omits null and undefined reasons', () => {
    expect(normalizeDiscussionLockAction({ locked: true, reason: null })).toEqual({ locked: true });
    expect(normalizeDiscussionLockAction({ locked: true, reason: undefined })).toEqual({
      locked: true,
    });
  });

  test('rejects invalid locked values and reasons', () => {
    for (const body of [undefined, null, {}, 'locked', 1, []]) {
      expect(captureError(() => normalizeDiscussionLockAction(body))).toMatchObject({
        statusCode: 400,
      });
    }

    expect(captureError(() => normalizeDiscussionLockAction({ locked: 'yes' }))).toMatchObject({
      statusCode: 400,
      statusMessage: 'locked must be a boolean',
    });

    for (const reason of ['', 'too heated', 'OFF_TOPIC', 'other', 42]) {
      expect(
        captureError(() => normalizeDiscussionLockAction({ locked: true, reason }))
      ).toMatchObject({
        statusCode: 400,
        statusMessage: 'Invalid lock reason. Must be one of: off-topic, too-heated, resolved, spam',
      });
    }
  });

  test('recognizes supported lock reasons', () => {
    expect(isDiscussionLockReason('off-topic')).toBe(true);
    expect(isDiscussionLockReason('too-heated')).toBe(true);
    expect(isDiscussionLockReason('resolved')).toBe(true);
    expect(isDiscussionLockReason('spam')).toBe(true);
    expect(isDiscussionLockReason('too heated')).toBe(false);
    expect(isDiscussionLockReason(undefined)).toBe(false);
  });
});
