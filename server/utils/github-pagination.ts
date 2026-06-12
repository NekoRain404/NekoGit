/** Metadata describing the current pagination state of a list response. */
export interface PaginationMeta {
  page: number;
  perPage: number;
  hasPrev: boolean;
  hasNext: boolean;
  totalCount: number | null;
  totalPages: number | null;
}

interface PaginateCollectionOptions {
  page: number;
  perPage: number;
  maxAccessibleItems?: number;
}

type PaginationLinkRel = 'first' | 'prev' | 'next' | 'last';

const positiveIntegerPattern = /^\d+$/;

/**
 * Parse a query-string value as a positive integer pagination parameter.
 * Returns `fallback` when the value is missing, non-numeric, or below 1,
 * and caps at `max` when provided.
 */
export function parsePaginationNumber(value: unknown, fallback: number, max?: number) {
  const rawValue = Array.isArray(value) ? value[0] : value;

  if (typeof rawValue !== 'string' || !positiveIntegerPattern.test(rawValue)) {
    return fallback;
  }

  const parsedValue = Number.parseInt(rawValue, 10);

  if (!Number.isSafeInteger(parsedValue) || parsedValue < 1) {
    return fallback;
  }

  return max ? Math.min(parsedValue, max) : parsedValue;
}

/**
 * Parse a GitHub-style `Link` header into a map of rel -> URL
 * (e.g. `{ next: 'https://...', last: 'https://...' }`).
 */
export function parseLinkHeader(linkHeader: string | undefined) {
  const links: Partial<Record<PaginationLinkRel, string>> = {};

  if (!linkHeader) {
    return links;
  }

  for (const part of linkHeader.split(',')) {
    const [rawUrl, rawRel] = part.split(';').map((segment) => segment.trim());
    const urlMatch = rawUrl?.match(/^<(.+)>$/);
    const relMatch = rawRel?.match(/^rel="(first|prev|next|last)"$/);

    if (!urlMatch || !relMatch) {
      continue;
    }

    links[relMatch[1] as PaginationLinkRel] = urlMatch[1];
  }

  return links;
}

/** Extract the `page` query parameter from a pagination link URL. */
function getPageFromLink(link: string | undefined) {
  if (!link) {
    return null;
  }

  try {
    const url = new URL(link);
    return parsePaginationNumber(url.searchParams.get('page'), 0) || null;
  } catch {
    return null;
  }
}

/**
 * Build normalized pagination metadata from an API response's Link header
 * and optional total count. Infers total pages from the `last` link when
 * the total count is unavailable.
 */
export function buildLinkedPaginationMeta(options: {
  page: number;
  perPage: number;
  linkHeader?: string;
  totalCount?: number | null;
}) {
  const { page, perPage, linkHeader, totalCount = null } = options;
  const links = parseLinkHeader(linkHeader);
  let normalizedPage = page;
  const hasPrev = Boolean(links.prev);
  const hasNext = Boolean(links.next);
  let totalPages = totalCount === null ? null : Math.max(1, Math.ceil(totalCount / perPage));

  // Derive total pages from Link header when total count is not provided by the API
  if (totalPages === null) {
    const lastPage = getPageFromLink(links.last);

    if (lastPage) {
      totalPages = lastPage;
      normalizedPage = Math.min(page, lastPage);
    } else if (!hasNext) {
      totalPages = page;
    }
  } else {
    normalizedPage = Math.min(page, totalPages);
  }

  return {
    page: normalizedPage,
    perPage,
    hasPrev: normalizedPage > 1 && hasPrev,
    hasNext,
    totalCount,
    totalPages,
  } satisfies PaginationMeta;
}

/**
 * Paginate an in-memory array, returning the slice for the requested page
 * along with computed pagination metadata. Optionally limits accessible items.
 */
export function paginateCollection<T>(items: T[], options: PaginateCollectionOptions) {
  const { page, perPage, maxAccessibleItems } = options;
  const effectiveItems = maxAccessibleItems ? items.slice(0, maxAccessibleItems) : items;
  const totalCount = effectiveItems.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / perPage));
  const normalizedPage = Math.min(page, totalPages);
  const startIndex = (normalizedPage - 1) * perPage;

  return {
    items: effectiveItems.slice(startIndex, startIndex + perPage),
    pagination: {
      page: normalizedPage,
      perPage,
      hasPrev: normalizedPage > 1,
      hasNext: normalizedPage < totalPages,
      totalCount,
      totalPages,
    } satisfies PaginationMeta,
  };
}
