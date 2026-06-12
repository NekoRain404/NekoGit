/// Marks multiple notification threads as read.
import {
  maxNotificationThreadIdsPerBatch,
  normalizeNotificationThreadIds,
} from '#shared/utils/github-notification-threads';

interface MarkNotificationThreadsReadBody {
  threadIds?: unknown;
}

interface MarkNotificationThreadFailure {
  threadId: string;
  message: string;
}

const normalizeRequestBody = (body: unknown) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid notification thread request body',
    });
  }

  const threadIds = normalizeNotificationThreadIds(
    (body as MarkNotificationThreadsReadBody).threadIds,
    maxNotificationThreadIdsPerBatch
  );

  if (!threadIds) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid notification thread request body',
    });
  }

  return threadIds;
};

const getFailureMessage = (error: unknown) => {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = error.message;
    if (typeof message === 'string' && message) return message;
  }

  return 'Failed to mark notification thread as read';
};

/** Batch-mark multiple notification threads as read with per-thread error reporting. */
export default defineEventHandler(async (event) => {
  const threadIds = normalizeRequestBody(await readBody(event));

  if (threadIds.length === 0) {
    return {
      items: [] as string[],
      failures: [] as MarkNotificationThreadFailure[],
    };
  }

  const octokit = await getGitHubClient(event);
  const items: string[] = [];
  const failures: MarkNotificationThreadFailure[] = [];

  await Promise.all(
    threadIds.map(async (threadId) => {
      try {
        await octokit.request('PATCH /notifications/threads/{thread_id}', {
          thread_id: Number.parseInt(threadId, 10),
        });
        items.push(threadId);
      } catch (error) {
        console.error('Error marking notification thread as read:', error);
        failures.push({
          threadId,
          message: getFailureMessage(error),
        });
      }
    })
  );

  return {
    items,
    failures,
  };
});
