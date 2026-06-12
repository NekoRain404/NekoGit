/// GET Repos / Contents
import { fetchRepoContents } from '#server/utils/repo-contents-utils';

/** Fetch repository file or directory contents at a given path. */
export default definePrivateApiCoalescedEventHandler(async (event) => {
  return fetchRepoContents(event);
});
