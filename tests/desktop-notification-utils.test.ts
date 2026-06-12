import { describe, expect, test } from 'vitest';

import {
  buildGitHubDesktopNotificationBatchPayload,
  buildGitHubDesktopNotificationPayload,
  resolveGitHubDesktopNotificationPayloads,
} from '../app/utils/desktop-notification-utils';
import type { DashboardNotification } from '../shared/types/notifications';

const notification = (overrides: Partial<DashboardNotification> = {}): DashboardNotification => ({
  id: overrides.id ?? 1,
  unread: overrides.unread ?? true,
  reason: overrides.reason ?? 'mention',
  repository: overrides.repository ?? {
    full_name: 'owner/repo',
  },
  subject: overrides.subject ?? {
    title: 'A new issue comment',
    type: 'Issue',
    url: 'https://api.github.com/repos/owner/repo/issues/42',
  },
});

describe('desktop notification helpers', () => {
  test('formats a GitHub notification for the desktop notification plugin', () => {
    expect(buildGitHubDesktopNotificationPayload(notification())).toEqual({
      title: 'A new issue comment',
      body: 'owner/repo - Mentioned you - Issue',
      group: 'github-notifications',
      number: 1,
      targetUrl: 'https://api.github.com/repos/owner/repo/issues/42',
    });
  });

  test('omits unsupported dashboard targets from single notification payloads', () => {
    expect(
      buildGitHubDesktopNotificationPayload(
        notification({
          subject: {
            title: 'A new release',
            type: 'Release',
            url: 'https://api.github.com/repos/owner/repo/releases/1',
          },
          html_url: 'https://example.com/release',
        })
      )
    ).toEqual({
      title: 'A new release',
      body: 'owner/repo - Mentioned you - Release',
      group: 'github-notifications',
      number: 1,
      targetUrl: undefined,
    });
  });

  test('uses a compact batch summary for multiple notifications', () => {
    expect(
      buildGitHubDesktopNotificationBatchPayload([
        notification({ id: 1 }),
        notification({ id: 2, repository: { full_name: 'owner/second' } }),
        notification({ id: 3, repository: { full_name: 'owner/third' } }),
        notification({ id: 4, repository: { full_name: 'owner/fourth' } }),
      ])
    ).toEqual({
      title: '4 new GitHub notifications',
      body: 'owner/repo, owner/second, owner/third +1 more',
      group: 'github-notifications',
      number: 4,
      targetTab: 'notifications',
    });
  });

  test('resolves notification payloads according to batching preference', () => {
    const notifications = [
      notification({ id: 1 }),
      notification({ id: 2, subject: { title: 'Second item', type: 'PullRequest' } }),
    ];

    expect(resolveGitHubDesktopNotificationPayloads(notifications)).toEqual([
      {
        title: '2 new GitHub notifications',
        body: 'owner/repo',
        group: 'github-notifications',
        number: 2,
        targetTab: 'notifications',
      },
    ]);

    expect(resolveGitHubDesktopNotificationPayloads(notifications, { batch: false })).toEqual([
      {
        title: 'A new issue comment',
        body: 'owner/repo - Mentioned you - Issue',
        group: 'github-notifications',
        number: 1,
        targetUrl: 'https://api.github.com/repos/owner/repo/issues/42',
      },
      {
        title: 'Second item',
        body: 'owner/repo - Mentioned you - PullRequest',
        group: 'github-notifications',
        number: 1,
        targetUrl: undefined,
      },
    ]);
  });
});
