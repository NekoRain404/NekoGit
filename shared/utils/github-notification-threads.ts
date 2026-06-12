/** Resolves github notification threads configuration from environment variables. */
export const maxNotificationThreadIdsPerBatch = 50;

/** notification Thread Id Pattern. */
const notificationThreadIdPattern = /^\d+$/;

/** normalize Notification Thread Id. */
export const normalizeNotificationThreadId = (value: unknown): string | null => {
  /** raw Value. */
  const rawValue =
    typeof value === 'number' ? String(value) : typeof value === 'string' ? value.trim() : '';

  if (!notificationThreadIdPattern.test(rawValue)) {
    return null;
  }

  /** thread Id. */
  const threadId = Number.parseInt(rawValue, 10);
  if (!Number.isSafeInteger(threadId) || threadId < 1) {
    return null;
  }

  return String(threadId);
};

/** normalize Notification Thread Ids. */
export const normalizeNotificationThreadIds = (
  value: unknown,
  maxThreadIds = maxNotificationThreadIdsPerBatch
): string[] | null => {
  if (!Array.isArray(value)) {
    return null;
  }

  /** normalized Thread Ids. */
  const normalizedThreadIds: string[] = [];
  /** seen Thread Ids. */
  const seenThreadIds = new Set<string>();

  for (const item of value) {
    /** thread Id. */
    const threadId = normalizeNotificationThreadId(item);
    if (!threadId) {
      return null;
    }

    if (!seenThreadIds.has(threadId)) {
      seenThreadIds.add(threadId);
      normalizedThreadIds.push(threadId);
    }

    if (normalizedThreadIds.length >= maxThreadIds) {
      break;
    }
  }

  return normalizedThreadIds;
};
