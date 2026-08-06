/// Shared types for dashboard issue/PR search results and repository list items.
import type { NotificationSubjectState } from './notifications';

/** Search Item Label. */
export interface SearchItemLabel {
  id: number | string;
  name: string;
  color: string;
}

/** Dashboard Issue Search Item. */
export interface DashboardIssueSearchItem {
  id: PropertyKey;
  title: string;
  repository_url: string;
  number: number;
  updated_at: string;
  type?: { name?: string };
  labels: SearchItemLabel[];
  merged_at?: string | null;
  state?: NotificationSubjectState;
  pull_request?: unknown;
  [key: string]: unknown;
}

/** Dashboard Repository List Item. */
export interface DashboardRepositoryListItem {
  id: PropertyKey;
  name: string;
  description?: string | null;
  language?: string | null;
  stargazers_count?: number;
  watchers_count?: number;
  forks_count?: number;
  private?: boolean;
  owner?: {
    login?: string;
  };
  [key: string]: unknown;
}
