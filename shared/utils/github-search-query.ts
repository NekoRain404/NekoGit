/// Builds GitHub search queries from custom tab query definitions.
/** Resolves github search query configuration from environment variables. */
import type {
  CustomTabOrder,
  CustomTabQuery,
  CustomTabSearchScope,
  CustomTabSearchType,
  CustomTabSort,
} from '#shared/types/custom-search';

/** Git Hub Issue Search Sort. */
export type GitHubIssueSearchSort = Exclude<CustomTabSort, 'best-match'>;

/** ISSUE SEARCH SORTS. */
const ISSUE_SEARCH_SORTS: readonly GitHubIssueSearchSort[] = [
  'comments',
  'reactions',
  'interactions',
  'created',
  'updated',
];

/** SEARCH SCOPES. */
const SEARCH_SCOPES: readonly CustomTabSearchScope[] = ['title', 'body', 'comments'];

/** TRIMMED QUERY PARAM FIELDS. */
const TRIMMED_QUERY_PARAM_FIELDS = [
  'text',
  'repo',
  'org',
  'user',
  'author',
  'assignee',
  'mentions',
  'commenter',
  'involves',
  'milestone',
  'base',
  'head',
] as const satisfies readonly (keyof CustomTabQuery)[];

/** SIMPLE QUERY PARAM FIELDS. */
const SIMPLE_QUERY_PARAM_FIELDS = [
  'type',
  'state',
  'visibility',
  'archived',
  'draft',
  'review',
  'order',
] as const satisfies readonly (keyof CustomTabQuery)[];

/** SEARCH QUALIFIER FIELDS. */
const SEARCH_QUALIFIER_FIELDS = [
  'repo',
  'org',
  'user',
  'author',
  'assignee',
  'mentions',
  'commenter',
  'involves',
  'milestone',
] as const satisfies readonly (keyof CustomTabQuery)[];

/** PULL SEARCH QUALIFIER FIELDS. */
const PULL_SEARCH_QUALIFIER_FIELDS = [
  'base',
  'head',
] as const satisfies readonly (keyof CustomTabQuery)[];

/** FALLBACK INVOLVES BLOCKING FIELDS. */
const FALLBACK_INVOLVES_BLOCKING_FIELDS = [
  'repo',
  'org',
  'user',
  'author',
  'assignee',
  'mentions',
  'commenter',
  'involves',
] as const satisfies readonly (keyof CustomTabQuery)[];

/** get One Year Ago Search Date. */
export const getOneYearAgoSearchDate = () => {
  /** today. */
  const today = new Date();
  /** one Year Ago. */
  const oneYearAgo = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
  return oneYearAgo.toISOString().slice(0, 10);
};

/** quote Search Value. */
export const quoteSearchValue = (value: string) => {
  return /[\s"]/.test(value) ? `"${value.replaceAll('"', '\\"')}"` : value;
};

/** normalize Issue Search Type. */
export const normalizeIssueSearchType = (value: string): CustomTabSearchType => {
  return value === 'pulls' || value === 'all' ? value : 'issues';
};

/** normalize Issue Search Sort. */
export const normalizeIssueSearchSort = (value: string): GitHubIssueSearchSort | '' => {
  return ISSUE_SEARCH_SORTS.includes(value as GitHubIssueSearchSort)
    ? (value as GitHubIssueSearchSort)
    : '';
};

/** normalize Issue Search Order. */
export const normalizeIssueSearchOrder = (value: string): CustomTabOrder => {
  return value === 'asc' ? 'asc' : 'desc';
};

/** normalize Issue Search Scopes. */
export const normalizeIssueSearchScopes = (values: string[]) => {
  return values.filter((scope): scope is CustomTabSearchScope => {
    return SEARCH_SCOPES.includes(scope as CustomTabSearchScope);
  });
};

/** clean List. */
const cleanList = (values: string[] | undefined) => {
  return values?.map((value) => value.trim()).filter((value) => value.length > 0) ?? [];
};

/** append Trimmed Param. */
const appendTrimmedParam = (params: URLSearchParams, key: string, value: string | undefined) => {
  /** trimmed Value. */
  const trimmedValue = value?.trim();
  if (trimmedValue) {
    params.set(key, trimmedValue);
  }
};

/** append Custom Tab Query Params. */
export const appendCustomTabQueryParams = (params: URLSearchParams, query: CustomTabQuery) => {
  for (const field of TRIMMED_QUERY_PARAM_FIELDS) {
    appendTrimmedParam(params, field, query[field]);
  }

  /** labels. */
  const labels = cleanList(query.labels);
  if (labels.length > 0) {
    params.set('labels', labels.join(','));
  }

  /** scopes. */
  const scopes = cleanList(query.scopes);
  if (scopes.length > 0) {
    params.set('scopes', scopes.join(','));
  }

  for (const field of SIMPLE_QUERY_PARAM_FIELDS) {
    /** value. */
    const value = query[field];
    if (value) params.set(field, value);
  }

  if (query.sort && query.sort !== 'best-match') params.set('sort', query.sort);
};

/** append Search Qualifier. */
const appendSearchQualifier = (parts: string[], qualifier: string, value: string | undefined) => {
  /** trimmed Value. */
  const trimmedValue = value?.trim();
  if (trimmedValue) {
    parts.push(`${qualifier}:${quoteSearchValue(trimmedValue)}`);
  }
};

/** build Issue Search Parts. */
export const buildIssueSearchParts = (
  query: CustomTabQuery,
  options: { createdAfter?: string; fallbackInvolves?: string } = {}
) => {
  /** text. */
  const text = query.text?.trim();
  /** parts. */
  const parts = text ? [text] : [];

  if (options.createdAfter) {
    parts.push(`created:>=${options.createdAfter}`);
  }

  if (query.type === 'pulls') {
    parts.push('is:pr');
  } else if (query.type !== 'all') {
    parts.push('is:issue');
  }

  if (query.archived === 'only') {
    parts.push('archived:true');
  } else if (query.archived !== 'include') {
    parts.push('archived:false');
  }

  if (query.state === 'open' || query.state === 'closed') {
    parts.push(`state:${query.state}`);
  }

  /** scopes. */
  const scopes = normalizeIssueSearchScopes(cleanList(query.scopes));
  if (scopes.length > 0) {
    parts.push(`in:${scopes.join(',')}`);
  }

  if (query.visibility === 'public' || query.visibility === 'private') {
    parts.push(`is:${query.visibility}`);
  }

  for (const field of SEARCH_QUALIFIER_FIELDS) {
    appendSearchQualifier(parts, field, query[field]);
  }

  for (const label of cleanList(query.labels)) {
    parts.push(`label:${quoteSearchValue(label)}`);
  }

  if (query.type === 'pulls' || query.type === 'all') {
    if (query.draft === 'draft') {
      parts.push('draft:true');
    } else if (query.draft === 'ready') {
      parts.push('draft:false');
    }

    if (
      query.review === 'none' ||
      query.review === 'required' ||
      query.review === 'approved' ||
      query.review === 'changes_requested'
    ) {
      parts.push(`review:${query.review}`);
    }

    for (const field of PULL_SEARCH_QUALIFIER_FIELDS) {
      appendSearchQualifier(parts, field, query[field]);
    }
  }

  if (
    options.fallbackInvolves &&
    !FALLBACK_INVOLVES_BLOCKING_FIELDS.some((field) => query[field])
  ) {
    parts.push(`involves:${options.fallbackInvolves}`);
  }

  return parts;
};
