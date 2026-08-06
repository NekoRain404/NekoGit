/// Builders for native desktop notification payloads from dashboard notifications.
import type { DashboardNotification } from '#shared/types/notifications';
import type { DashboardTab } from '~/composables/useDashboardTabs';

import { parseDashboardUrlTarget } from './dashboard-url-navigation-utils';

/** Shape of a native desktop notification ready for display. */
export interface DesktopNotificationPayload {
  title: string;
  body?: string;
  group: string;
  number?: number;
  targetUrl?: string;
  targetTab?: DashboardTab;
}

/** Options controlling notification batching behavior. */
export interface GitHubDesktopNotificationPayloadOptions {
  batch?: boolean;
}

const notificationGroup = 'github-notifications';
const maxTitleLength = 120;
const maxBodyLength = 180;
const maxRepositoryCount = 3;

const reasonLabels: Record<string, string> = {
  approval_requested: 'Deployment approval requested',
  assign: 'Assigned to you',
  author: 'You created the thread',
  ci_activity: 'CI activity',
  comment: 'New comment',
  invitation: 'Repository invitation',
  manual: 'Manually subscribed',
  member_feature_requested: 'Organization feature request',
  mention: 'Mentioned you',
  review_requested: 'Review requested',
  security_advisory_credit: 'Security advisory credit',
  security_alert: 'Security alert',
  state_change: 'State changed',
  subscribed: 'Watching repository',
  team_mention: 'Team mentioned',
};

const normalizeText = (value: unknown) => {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
};

const truncateText = (value: string, maxLength: number) => {
  if (value.length <= maxLength) return value;

  return `${value.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
};

const getReasonLabel = (reason: unknown) => {
  const normalizedReason = normalizeText(reason);
  return normalizedReason ? (reasonLabels[normalizedReason] ?? normalizedReason) : '';
};

const uniqueNonEmpty = (values: string[]) => {
  return Array.from(new Set(values.filter(Boolean)));
};

const resolveDashboardTargetUrl = (notification: DashboardNotification) => {
  const candidates = [notification.subject?.url, notification.html_url]
    .map((value) => normalizeText(value))
    .filter(Boolean);

  return candidates.find((candidate) => parseDashboardUrlTarget(candidate)) ?? undefined; // prefer the first URL that resolves to a valid dashboard target
};

/** Builds a desktop notification payload from a single GitHub notification. */
export const buildGitHubDesktopNotificationPayload = (
  notification: DashboardNotification
): DesktopNotificationPayload => {
  const subjectTitle = normalizeText(notification.subject?.title) || 'New GitHub notification';
  const repositoryName = normalizeText(notification.repository?.full_name);
  const reasonLabel = getReasonLabel(notification.reason);
  const subjectType = normalizeText(notification.subject?.type);
  const body = [repositoryName, reasonLabel, subjectType].filter(Boolean).join(' - ');

  return {
    title: truncateText(subjectTitle, maxTitleLength),
    body: body ? truncateText(body, maxBodyLength) : undefined,
    group: notificationGroup,
    number: notification.unread === false ? undefined : 1,
    targetUrl: resolveDashboardTargetUrl(notification),
  };
};

/**
 * Builds a summary desktop notification payload from a batch of GitHub
 * notifications.
 */
export const buildGitHubDesktopNotificationBatchPayload = (
  notifications: DashboardNotification[]
): DesktopNotificationPayload | null => {
  const firstNotification = notifications[0];
  if (!firstNotification) return null;
  if (notifications.length === 1) return buildGitHubDesktopNotificationPayload(firstNotification);

  const repositories = uniqueNonEmpty(
    notifications.map((notification) => normalizeText(notification.repository?.full_name))
  );
  const visibleRepositories = repositories.slice(0, maxRepositoryCount);
  const hiddenRepositoryCount = repositories.length - visibleRepositories.length;
  const repositorySummary = [
    visibleRepositories.join(', '),
    hiddenRepositoryCount > 0 ? `+${hiddenRepositoryCount} more` : '',
  ]
    .filter(Boolean)
    .join(' ');

  return {
    title: `${notifications.length} new GitHub notifications`,
    body: repositorySummary || 'Open NekoGit to review them.',
    group: notificationGroup,
    number: notifications.length,
    targetTab: 'notifications',
  };
};

/**
 * Resolves notifications into display payloads, batching when multiple are
 * present.
 */
export const resolveGitHubDesktopNotificationPayloads = (
  notifications: DashboardNotification[],
  options: GitHubDesktopNotificationPayloadOptions = {}
): DesktopNotificationPayload[] => {
  if (notifications.length === 0) return [];
  if (notifications.length === 1 || options.batch === false) {
    return notifications.map((notification) => buildGitHubDesktopNotificationPayload(notification));
  }

  const payload = buildGitHubDesktopNotificationBatchPayload(notifications);
  return payload ? [payload] : [];
};
