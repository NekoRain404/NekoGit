import type { NotificationSubjectState } from './notifications';

export interface SearchItemLabel {
  id: number | string;
  name: string;
  color: string;
}

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
