/// Unit tests for notification thread activity signatures.
import { describe, expect, test } from 'vitest';

import type { DashboardNotification } from '../shared/types/notifications';
import {
  buildNotificationActivitySignature,
  collectNotificationActivitySignatures,
  resolveNotificationActivityId,
  selectNewUnreadNotifications,
} from '../shared/utils/notification-activity';

const notification = (overrides: Partial<DashboardNotification> = {}): DashboardNotification => ({
  id: 1,
  updated_at: '2026-11-04T00:00:00Z',
  unread: true,
  ...overrides,
});

describe('notification activity signatures', () => {
  test('resolves ids with an index fallback', () => {
    expect(resolveNotificationActivityId(notification({ id: 42 }), 0)).toBe('42');
    expect(resolveNotificationActivityId(notification({ id: undefined }), 3)).toBe('fallback-3');
  });

  test('builds signatures from id, updated_at, and unread state', () => {
    expect(buildNotificationActivitySignature(notification(), 0)).toBe(
      '1|2026-11-04T00:00:00Z|unread'
    );
    expect(buildNotificationActivitySignature(notification({ unread: false }), 0)).toBe(
      '1|2026-11-04T00:00:00Z|read'
    );
    expect(
      buildNotificationActivitySignature(notification({ updated_at: '2026-11-04T01:00:00Z' }), 0)
    ).toBe('1|2026-11-04T01:00:00Z|unread');
  });

  test('collects one signature per notification', () => {
    const signatures = collectNotificationActivitySignatures([
      notification({ id: 1 }),
      notification({ id: 2, updated_at: '2026-11-03T00:00:00Z' }),
    ]);

    expect(signatures.size).toBe(2);
    expect(signatures.has('1|2026-11-04T00:00:00Z|unread')).toBe(true);
    expect(signatures.has('2|2026-11-03T00:00:00Z|unread')).toBe(true);
  });

  test('selects unread items that were absent from the previous poll', () => {
    const previous = new Set<string>();

    expect(selectNewUnreadNotifications([notification({ id: 1 })], previous)).toHaveLength(1);
  });

  test('does not repeat notifications for unchanged unread items', () => {
    const items = [notification({ id: 1 })];
    const previous = collectNotificationActivitySignatures(items);

    expect(selectNewUnreadNotifications(items, previous)).toHaveLength(0);
  });

  test('notifies when an existing thread gains new activity', () => {
    const previous = collectNotificationActivitySignatures([
      notification({ id: 1, updated_at: '2026-11-04T00:00:00Z' }),
    ]);
    const current = [notification({ id: 1, updated_at: '2026-11-04T05:00:00Z' })];

    expect(selectNewUnreadNotifications(current, previous)).toEqual(current);
  });

  test('ignores read items and items that only became read', () => {
    const previous = collectNotificationActivitySignatures([notification({ id: 1 })]);
    const current = [notification({ id: 1, unread: false })];

    expect(selectNewUnreadNotifications(current, previous)).toHaveLength(0);
  });

  test('notifies when an unchanged thread becomes unread again', () => {
    const previous = collectNotificationActivitySignatures([
      notification({ id: 1, unread: false }),
    ]);
    const current = [notification({ id: 1, unread: true })];

    expect(selectNewUnreadNotifications(current, previous)).toEqual(current);
  });
});
