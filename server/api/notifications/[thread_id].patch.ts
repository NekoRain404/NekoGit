/// Marks a single notification thread as read or unread.
import { normalizeNotificationThreadId } from '#shared/utils/github-notification-threads';

/** Mark a single notification thread as read. */
export default defineEventHandler(async (event) => {
  const threadIdParam = getRouterParam(event, 'thread_id') ?? '';
  const threadId = normalizeNotificationThreadId(threadIdParam);

  if (!threadId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid notification thread id',
    });
  }

  const octokit = await getGitHubClient(event);

  try {
    const { data } = await octokit.request('PATCH /notifications/threads/{thread_id}', {
      thread_id: Number.parseInt(threadId, 10),
    });
    return data;
  } catch (error) {
    console.error('Error marking notification as read:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to mark notification as read',
    });
  }
});
