/// Types for GitHub notification subjects, repositories, and subject-state lookups.
/** Notification Subject Kind. */
export type NotificationSubjectKind = 'Issue' | 'PullRequest' | 'Discussion' | 'Release' | string;

/** Notification Subject State. */
export type NotificationSubjectState = 'open' | 'closed' | 'merged';

/** Notification Subject State Status. */
export type NotificationSubjectStateStatus = 'pending' | 'loaded' | 'error' | 'unavailable';

/** Dashboard Notification Subject. */
export interface DashboardNotificationSubject {
  title?: string;
  type?: NotificationSubjectKind;
  url?: string;
  number?: number;
  state?: NotificationSubjectState;
  stateStatus?: NotificationSubjectStateStatus;
}

/** Dashboard Notification Repository. */
export interface DashboardNotificationRepository {
  full_name?: string;
  owner?: {
    avatar_url?: string;
    login?: string;
  };
}

/** Dashboard Notification. */
export interface DashboardNotification {
  id: PropertyKey;
  subject?: DashboardNotificationSubject;
  repository?: DashboardNotificationRepository;
  unread?: boolean;
  updated_at?: string;
  reason?: string;
  html_url?: string;
  /** Optional client-side flag used after unsubscribing from a thread. */
  subscribed?: boolean;
  /** Optional subscription metadata when a future GitHub payload includes it. */
  subscription?: { subscribed?: boolean; [key: string]: unknown };
  [key: string]: unknown;
}

/** Notification Subject State Target. */
export interface NotificationSubjectStateTarget {
  key: string;
  owner: string;
  repo: string;
  type: 'issues' | 'pulls';
  number: number;
}

/** Notification Subject State Result. */
export interface NotificationSubjectStateResult {
  key: string;
  state?: NotificationSubjectState;
}
