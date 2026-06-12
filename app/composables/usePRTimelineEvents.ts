import { computed, toValue, type MaybeRefOrGetter } from 'vue';

import parseGitHubMarkdownTarget from '~/utils/parseGitHubMarkdownTarget';
import parseGitHubRepoPath from '~/utils/parseGitHubRepoPath';

/** An actor (user, bot, or app) that appears in a timeline event. */
export interface TimelineActor {
  resourceType?: string;
  login?: string;
  avatarUrl?: string;
  url?: string;
  name?: string;
  slug?: string;
}

/** A repository referenced in a cross-link or cross-reference. */
export interface TimelineRepository {
  name?: string;
  nameWithOwner?: string;
  owner?: {
    login?: string;
  };
}

/** A cross-reference target (issue or pull request) with optional repo context. */
export interface TimelineReference {
  resourceType?: 'issue' | 'pull-request';
  number?: number;
  title?: string;
  url?: string;
  state?: string;
  repository?: TimelineRepository;
}

/** A label attached to an issue or pull request. */
export interface TimelineLabel {
  name?: string;
  color?: string;
}

/** A git commit entry shown in the timeline. */
export interface TimelineCommit {
  oid?: string;
  message?: string;
  url?: string;
  commitUrl?: string;
  committedDate?: string;
  author?: {
    name?: string;
    user?: TimelineActor;
  };
}

/** A pull request review comment (inline diff comment). */
export interface TimelineReviewComment {
  id?: string;
  threadId?: string;
  author?: TimelineActor;
  body?: string;
  createdAt?: string;
  path?: string;
  url?: string;
  diffHunk?: string;
  pullRequestReviewId?: string;
  inReplyToId?: string;
  position?: number;
  originalPosition?: number;
  startLine?: number;
  originalStartLine?: number;
  line?: number;
  originalLine?: number;
  startSide?: string;
  side?: string;
  isResolved?: boolean;
  isOutdated?: boolean;
  resolvedBy?: TimelineActor;
}

/** A review dismissal event with the actor and optional message. */
export interface TimelineReviewDismissal {
  actor?: TimelineActor;
  createdAt?: string;
  message?: string;
  commitId?: string;
  previousState?: string;
}

/** A user or team requested for review. */
export interface TimelineRequestedReviewer {
  resourceType?: string;
  login?: string;
  name?: string;
  slug?: string;
  avatarUrl?: string;
  url?: string;
}

/** A project (classic or Projects v2) referenced in a timeline event. */
export interface TimelineProject {
  title?: string;
  url?: string;
  name?: string;
}

/** A single item from the GitHub pull request timeline. */
export interface PRTimelineItem {
  kind: 'comment' | 'event' | 'review' | 'review-comment' | 'commit' | 'unsupported';
  eventType?: string;
  id?: string;
  createdAt?: string;
  timelineSource?: string;
  degraded?: boolean;
  displayText?: string;
  body?: string;
  url?: string;
  state?: string;
  actor?: TimelineActor;
  author?: TimelineActor;
  assignee?: TimelineRequestedReviewer;
  enqueuer?: TimelineActor;
  mergeQueue?: { id?: string };
  project?: TimelineProject;
  projectColumnName?: string;
  milestoneTitle?: string;
  source?: TimelineReference;
  subject?: TimelineReference & { login?: string };
  blockingIssue?: TimelineReference;
  blockedIssue?: TimelineReference;
  canonical?: TimelineReference;
  duplicate?: TimelineReference;
  parent?: TimelineReference;
  subIssue?: TimelineReference;
  fromRepository?: TimelineRepository & { url?: string };
  label?: TimelineLabel;
  lockReason?: string;
  stateReason?: string;
  currentRefName?: string;
  previousRefName?: string;
  oldBase?: string;
  newBase?: string;
  baseRefName?: string;
  discussion?: { title?: string };
  deployment?: { environment?: string };
  deploymentStatus?: { environment?: string };
  prevIssueType?: { name?: string };
  issueType?: { name?: string };
  previousProjectColumnName?: string;
  previousStatus?: string;
  status?: string;
  review?: {
    id?: string;
    author?: TimelineActor;
    state?: string;
    dismissalMessage?: string;
    dismissalCommitId?: string;
  };
  reviewId?: string;
  threadId?: string;
  commitId?: string;
  reviewComments?: TimelineReviewComment[];
  dismissal?: TimelineReviewDismissal;
  requestedReviewer?: TimelineRequestedReviewer;
  deletedCommentAuthor?: { login?: string };
  commit?: TimelineCommit;
  beforeCommit?: TimelineCommit;
  afterCommit?: TimelineCommit;
  ref?: { name?: string };
  isResolved?: boolean;
  isOutdated?: boolean;
  path?: string;
  resolvedBy?: TimelineActor;
  currentTitle?: string;
  previousTitle?: string;
  reason?: string;
  reasonCode?: string;
  restEvent?: string;
  projectCard?: { project?: TimelineProject };
  issueField?: { resourceType?: string; name?: string };
  originalUrl?: string;
  pullRequestReviewUrl?: string;
  pullRequestReviewId?: string;
  inReplyToId?: string;
  diffHunk?: string;
}

/** PR timeline item enriched with a stable render key for Vue list rendering. */
export interface ProcessedPRTimelineItem extends PRTimelineItem {
  renderKey: string;
}

/** Build a stable unique key for a PR timeline item. */
export function buildPRTimelineItemKey(item: PRTimelineItem, index: number): string {
  if (item.id) return item.id;
  if (item.commit?.oid) return `commit-${item.commit.oid}`;

  const actor = item.actor?.login ?? item.author?.login ?? 'unknown';
  const createdAt = item.createdAt ?? item.commit?.committedDate ?? 'no-date';
  const number =
    item.source?.number ?? item.blockingIssue?.number ?? item.blockedIssue?.number ?? index;

  return `${item.kind}-${item.eventType ?? 'unknown'}-${createdAt}-${actor}-${number}`;
}

/** Filter redundant close-after-merge events and attach render keys. */
export function normalizePRTimelineItems(timeline: PRTimelineItem[]): ProcessedPRTimelineItem[] {
  return timeline
    .filter((item, index, array) => {
      // Skip "closed" events that immediately follow a "merged" event —
      // merge always implies close, so the redundant close is noise.
      if (item.eventType === 'closed' && index > 0) {
        const prev = array[index - 1];
        if (
          prev?.eventType === 'merged' &&
          prev.actor?.login === item.actor?.login &&
          prev.createdAt === item.createdAt
        ) {
          return false;
        }
      }
      return true;
    })
    .map((item, index) => ({
      ...item,
      renderKey: buildPRTimelineItemKey(item, index),
    }));
}

/** Normalize and deduplicate PR timeline items for rendering. */
export function usePRTimelineEvents(timeline: MaybeRefOrGetter<PRTimelineItem[]>) {
  const processedTimeline = computed(() => normalizePRTimelineItems(toValue(timeline)));

  return {
    processedTimeline,
  };
}

/** Split an `owner/repo` string into its parts. */
export function parseRepoFullName(repoFullName?: string): { owner: string; repo: string } | null {
  const repoPath = parseGitHubRepoPath(repoFullName);
  if (!repoPath) return null;

  return {
    owner: repoPath.owner,
    repo: repoPath.repo,
  };
}

/** Parse a GitHub issue or PR URL into kind/owner/repo/number. */
export function parseGitHubIssueOrPullUrl(url?: string) {
  const target = parseGitHubMarkdownTarget(url);
  if (!target) return null;

  return {
    kind: target.type,
    owner: target.owner,
    repo: target.repo,
    number: target.number,
  };
}

/** Derive a display label for a requested reviewer (user, team, or org). */
export function getRequestedReviewerLabel(reviewer?: TimelineRequestedReviewer): string {
  if (!reviewer) return 'reviewer';

  if (reviewer.resourceType === 'Team') {
    return reviewer.slug ? `@${reviewer.slug}` : (reviewer.name ?? 'team');
  }

  if (reviewer.resourceType === 'Organization') {
    return reviewer.login ?? reviewer.name ?? 'organization';
  }

  return reviewer.login ?? reviewer.name ?? 'reviewer';
}

/** Resolve the profile URL for a requested reviewer. */
export function getRequestedReviewerUrl(reviewer?: TimelineRequestedReviewer): string | undefined {
  if (!reviewer) return undefined;
  if (reviewer.url) return reviewer.url;
  if (reviewer.login) return `https://github.com/${reviewer.login}`;
  return undefined;
}
