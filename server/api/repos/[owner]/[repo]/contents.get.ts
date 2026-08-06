/// Fetches the root directory listing of a repository.
import { fetchRepoContents } from '#server/utils/repo-contents-utils';

/** Fetch the root directory listing of a repository. */
export default definePrivateApiCoalescedEventHandler(async (event) => {
  return fetchRepoContents(event, '');
});
