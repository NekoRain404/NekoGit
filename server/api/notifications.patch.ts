/// Marks notifications as read or unread in bulk.
/** Mark all notifications as read for the authenticated user. */
export default defineEventHandler(async (event) => {
  const octokit = await getGitHubClient(event);

  try {
    const { data } = await octokit.request('PUT /notifications');
    return data;
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to mark all notifications as read',
    });
  }
});
