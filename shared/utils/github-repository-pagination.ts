/// Repository total-count derivation for paginated GitHub repository lists.

export interface RepositoryTotalCountInput {
  page: number;
  perPage: number;
  lastPage: number;
  lastPageCount: number;
}

/**
 * Derive an exact repository total from the number of items on the last page.
 * The Link header's last page is authoritative when the requested page is out
 * of range; `page` is only a fallback for responses without a Link header.
 */
export function computeRepositoryTotalCount({
  page,
  perPage,
  lastPage,
  lastPageCount,
}: RepositoryTotalCountInput): number {
  const effectiveLastPage = lastPage >= 1 ? lastPage : Math.max(1, page);
  const effectiveLastPageCount = Math.max(0, lastPageCount);

  return (effectiveLastPage - 1) * perPage + effectiveLastPageCount;
}
