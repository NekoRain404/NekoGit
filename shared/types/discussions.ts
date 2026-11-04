/// Types for GitHub discussions, including detail, comments, and reply payloads.
/** Discussion Author. */
export interface DiscussionAuthor {
  login: string;
  avatarUrl?: string;
  url?: string;
}

/** Discussion Category. */
export interface DiscussionCategory {
  id: string;
  name: string;
  emoji?: string;
  description?: string | null;
  isAnswerable: boolean;
  slug?: string;
}

/** Discussion Page Info. */
export interface DiscussionPageInfo {
  hasNextPage: boolean;
  endCursor: string | null;
}

/** Discussion Reply. */
export interface DiscussionReply {
  id: string;
  nodeId: string;
  body: string;
  url?: string;
  createdAt?: string;
  updatedAt?: string;
  author: DiscussionAuthor | null;
  isAnswer: boolean;
  replyToId: string | null;
  upvoteCount: number;
  viewerHasUpvoted: boolean;
}

/** Discussion Replies Payload. */
export interface DiscussionRepliesPayload {
  items: DiscussionReply[];
  totalCount: number;
  pageInfo: DiscussionPageInfo;
}

/** Discussion Comment. */
export interface DiscussionComment extends DiscussionReply {
  replies: DiscussionRepliesPayload;
}

/** Discussion Comments Payload. */
export interface DiscussionCommentsPayload {
  items: DiscussionComment[];
  totalCount: number;
  pageInfo: DiscussionPageInfo;
}

/** Discussion Detail Payload. */
export interface DiscussionDetailPayload {
  id: string;
  nodeId: string;
  number: number;
  title: string;
  body: string;
  url?: string;
  createdAt?: string;
  updatedAt?: string;
  author: DiscussionAuthor | null;
  category: DiscussionCategory | null;
  isAnswered: boolean;
  answer: DiscussionReply | null;
  locked: boolean;
  upvoteCount: number;
  viewerHasUpvoted: boolean;
  comments: DiscussionCommentsPayload;
  owner: string;
  repo: string;
  repository_url: string;
}
