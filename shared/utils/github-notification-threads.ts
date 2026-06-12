/** Resolves github notification threads configuration from environment variables. */
export const maxNotificationThreadIdsPerBatch = 50;

const notificationThreadIdPattern = /^\d+$/;

export const normalizeNotificationThreadId = (value: unknown): string | null => {
  const rawValue =
    typeof value === 'number' ? String(value) : typeof value === 'string' ? value.trim() : '';

  if (!notificationThreadIdPattern.test(rawValue)) {
    return null;
  }

  const threadId = Number.parseInt(rawValue, 10);
  if (!Number.isSafeInteger(threadId) || threadId < 1) {
    return null;
  }

  return String(threadId);
};

export const normalizeNotificationThreadIds = (
  value: unknown,
  maxThreadIds = maxNotificationThreadIdsPerBatch
): string[] | null => {
  if (!Array.isArray(value)) {
    return null;
  }

  const normalizedThreadIds: string[] = [];
  const seenThreadIds = new Set<string>();

  for (const item of value) {
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
