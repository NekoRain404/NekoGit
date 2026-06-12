import { describe, expect, test } from 'vitest';

import {
  maxNotificationThreadIdsPerBatch,
  normalizeNotificationThreadId,
  normalizeNotificationThreadIds,
} from '../shared/utils/github-notification-threads';

describe('GitHub notification thread helpers', () => {
  test('normalizes valid thread ids', () => {
    expect(normalizeNotificationThreadId(' 42 ')).toBe('42');
    expect(normalizeNotificationThreadId(7)).toBe('7');
  });

  test('rejects invalid thread ids', () => {
    expect(normalizeNotificationThreadId('0')).toBeNull();
    expect(normalizeNotificationThreadId('-1')).toBeNull();
    expect(normalizeNotificationThreadId('abc')).toBeNull();
    expect(normalizeNotificationThreadId('1.2')).toBeNull();
    expect(normalizeNotificationThreadId(Number.MAX_SAFE_INTEGER + 1)).toBeNull();
  });

  test('deduplicates and caps thread id batches', () => {
    const ids = Array.from({ length: maxNotificationThreadIdsPerBatch + 5 }, (_, index) =>
      String(index + 1)
    );

    expect(normalizeNotificationThreadIds(['1', 1, '2', '2'])).toEqual(['1', '2']);
    expect(normalizeNotificationThreadIds(ids)).toHaveLength(maxNotificationThreadIdsPerBatch);
  });

  test('rejects invalid batch bodies', () => {
    expect(normalizeNotificationThreadIds(null)).toBeNull();
    expect(normalizeNotificationThreadIds(['1', 'bad'])).toBeNull();
  });
});
