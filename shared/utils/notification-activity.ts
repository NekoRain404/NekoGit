/// Helpers for detecting new activity in GitHub notification threads.
import type { DashboardNotification } from '#shared/types/notifications';

/** Resolve a stable notification thread identifier, with an index fallback. */
export const resolveNotificationActivityId = (
  notification: DashboardNotification,
  fallbackIndex: number
): string => {
  if (notification.id === undefined || notification.id === null) {
    return `fallback-${fallbackIndex}`;
  }

  return String(notification.id);
};

/**
 * Build a signature for one notification thread.
 *
 * Including `updated_at` and `unread` lets polling notice new activity on an
 * existing thread while the signature remains stable for unchanged items.
 */
export const buildNotificationActivitySignature = (
  notification: DashboardNotification,
  fallbackIndex: number
): string => {
  const id = resolveNotificationActivityId(notification, fallbackIndex);
  const updatedAt = typeof notification.updated_at === 'string' ? notification.updated_at : '';
  const unread = notification.unread === false ? 'read' : 'unread';

  return `${id}|${updatedAt}|${unread}`;
};

/** Collect activity signatures for all notifications in a poll response. */
export const collectNotificationActivitySignatures = (
  notifications: DashboardNotification[]
): Set<string> => {
  return new Set(
    notifications.map((item, index) => buildNotificationActivitySignature(item, index))
  );
};

/** Select unread notifications whose activity signature was not seen before. */
export const selectNewUnreadNotifications = (
  notifications: DashboardNotification[],
  previousSignatures: Set<string>
): DashboardNotification[] => {
  return notifications.filter((item, index) => {
    if (item.unread === false) {
      return false;
    }

    return !previousSignatures.has(buildNotificationActivitySignature(item, index));
  });
};
