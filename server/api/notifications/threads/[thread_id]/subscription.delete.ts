/// Removes the authenticated user's subscription to a notification thread.
import { normalizeNotificationThreadId } from '#shared/utils/github-notification-threads';

/** Unsubscribe the authenticated user from a notification thread. */
export default defineEventHandler(async (event) => {
  const threadIdParam = getRouterParam(event, 'thread_id') ?? '';
  const threadId = normalizeNotificationThreadId(threadIdParam);

  if (!threadId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid notification thread id',
    });
  }

  try {
    const octokit = await getGitHubClient(event);

    await octokit.request('DELETE /notifications/threads/{thread_id}/subscription', {
      thread_id: Number.parseInt(threadId, 10),
    });

    return { ok: true };
  } catch (error) {
    console.error('Error unsubscribing from notification thread:', error);
    throwGitHubRouteError(error, 'Failed to unsubscribe from notification thread');
  }
});
