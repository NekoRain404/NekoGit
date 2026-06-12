/** Custom Tab State. */
export type CustomTabState = 'open' | 'closed' | 'all';
/** Custom Tab Source. */
export type CustomTabSource = 'github-search';
/** Custom Tab Search Type. */
export type CustomTabSearchType = 'issues' | 'pulls' | 'all';
/** Custom Tab Search Scope. */
export type CustomTabSearchScope = 'title' | 'body' | 'comments';
/** Custom Tab Sort. */
export type CustomTabSort =
  | 'best-match'
  | 'comments'
  | 'reactions'
  | 'interactions'
  | 'created'
  | 'updated';
/** Custom Tab Order. */
export type CustomTabOrder = 'desc' | 'asc';
/** Custom Tab Visibility. */
export type CustomTabVisibility = 'any' | 'public' | 'private';
/** Custom Tab Archived. */
export type CustomTabArchived = 'exclude' | 'include' | 'only';
/** Custom Tab Draft. */
export type CustomTabDraft = 'any' | 'draft' | 'ready';
/** Custom Tab Review. */
export type CustomTabReview = 'any' | 'none' | 'required' | 'approved' | 'changes_requested';

/** Custom Tab Query. */
export interface CustomTabQuery {
  text?: string;
  type?: CustomTabSearchType;
  repo?: string;
  org?: string;
  user?: string;
  labels?: string[];
  author?: string;
  assignee?: string;
  mentions?: string;
  commenter?: string;
  involves?: string;
  milestone?: string;
  state?: CustomTabState;
  scopes?: CustomTabSearchScope[];
  visibility?: CustomTabVisibility;
  archived?: CustomTabArchived;
  draft?: CustomTabDraft;
  review?: CustomTabReview;
  base?: string;
  head?: string;
  sort?: CustomTabSort;
  order?: CustomTabOrder;
  perPage?: number;
}

/** Custom Tab. */
export interface CustomTab {
  id: string;
  groupId: string;
  name: string;
  subtitle?: string;
  source: CustomTabSource;
  query: CustomTabQuery;
}
