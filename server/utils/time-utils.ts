///  Utils / Time Utils - Date helpers, e.g. one year ago formatted for GitHub search queries.
import { getOneYearAgoSearchDate } from '#shared/utils/github-search-query';

/**
 * Return a date string representing one year ago from today,
 * formatted for use in GitHub search queries.
 */
export function getOneYearAgoDate(): string {
  return getOneYearAgoSearchDate();
}
