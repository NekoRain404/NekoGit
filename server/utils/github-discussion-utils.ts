///  Utils / Github Discussion Utils - Fetches GitHub discussions and comments via GraphQL and normalizes them for the frontend.
import type { Octokit } from '@octokit/core';

import type {
  DiscussionAuthor,
  DiscussionCategory,
  DiscussionComment,
  DiscussionCommentsPayload,
  DiscussionDetailPayload,
  DiscussionPageInfo,
  DiscussionRepliesPayload,
  DiscussionReply,
} from '#shared/types/discussions';
import type { DiscussionLockReason } from '#shared/utils/discussion-actions';

type GitHubClient = Octokit;

const DISCUSSION_COMMENTS_PAGE_SIZE = 20;
const DISCUSSION_REPLIES_PAGE_SIZE = 20;
const INITIAL_REPLIES_PAGE_SIZE = 5;

interface DiscussionActorPayload {
  login?: string | null;
  avatarUrl?: string | null;
  url?: string | null;
}

interface DiscussionCategoryPayload {
  id?: string | null;
  name?: string | null;
  emoji?: string | null;
  description?: string | null;
  isAnswerable?: boolean | null;
  slug?: string | null;
}

interface DiscussionPageInfoPayload {
  hasNextPage?: boolean | null;
  endCursor?: string | null;
}

interface DiscussionConnectionPayload<TNode> {
  totalCount?: number | null;
  nodes?: (TNode | null)[] | null;
  pageInfo?: DiscussionPageInfoPayload | null;
}

interface DiscussionReplyPayload {
  id?: string | null;
  body?: string | null;
  url?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  isAnswer?: boolean | null;
  upvoteCount?: number | null;
  viewerHasUpvoted?: boolean | null;
  author?: DiscussionActorPayload | null;
  replyTo?: {
    id?: string | null;
  } | null;
}

interface DiscussionCommentPayload extends DiscussionReplyPayload {
  replies?: DiscussionConnectionPayload<DiscussionReplyPayload> | null;
}

interface DiscussionRepositoryPayload {
  name?: string | null;
  owner?: {
    login?: string | null;
  } | null;
}

interface DiscussionParentPayload {
  id?: string | null;
  number?: number | null;
  repository?: DiscussionRepositoryPayload | null;
}

interface DiscussionPayload {
  id?: string | null;
  number?: number | null;
  title?: string | null;
  body?: string | null;
  url?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  locked?: boolean | null;
  isAnswered?: boolean | null;
  upvoteCount?: number | null;
  viewerHasUpvoted?: boolean | null;
  author?: DiscussionActorPayload | null;
  category?: DiscussionCategoryPayload | null;
  answer?: DiscussionReplyPayload | null;
  comments?: DiscussionConnectionPayload<DiscussionCommentPayload> | null;
}

interface FetchDiscussionResponse {
  repository?: {
    discussion?: DiscussionPayload | null;
  } | null;
}

interface FetchDiscussionCommentsResponse {
  repository?: {
    discussion?: {
      comments?: DiscussionConnectionPayload<DiscussionCommentPayload> | null;
    } | null;
  } | null;
}

interface FetchDiscussionCommentRepliesResponse {
  node?: {
    discussion?: DiscussionParentPayload | null;
    replyTo?: {
      id?: string | null;
    } | null;
    replies?: DiscussionConnectionPayload<DiscussionReplyPayload> | null;
  } | null;
}

interface FetchDiscussionNodeIdResponse {
  repository?: {
    discussion?: {
      id?: string | null;
    } | null;
  } | null;
}

interface FetchDiscussionReplyContextResponse {
  repository?: {
    discussion?: {
      id?: string | null;
    } | null;
  } | null;
  node?: {
    discussion?: DiscussionParentPayload | null;
    replyTo?: {
      id?: string | null;
    } | null;
  } | null;
}

interface AddDiscussionCommentResponse {
  addDiscussionComment?: {
    comment?: DiscussionCommentPayload | null;
  } | null;
}

interface DiscussionCommentAnswerMutationResponse {
  markDiscussionCommentAsAnswer?: { clientMutationId?: string | null } | null;
  unmarkDiscussionCommentAsAnswer?: { clientMutationId?: string | null } | null;
}

interface DiscussionUpvoteSubjectPayload {
  id?: string | null;
  upvoteCount?: number | null;
  viewerHasUpvoted?: boolean | null;
}

interface DiscussionUpvoteMutationResponse {
  addUpvote?: { subject?: DiscussionUpvoteSubjectPayload | null } | null;
  removeUpvote?: { subject?: DiscussionUpvoteSubjectPayload | null } | null;
}

interface DiscussionLockablePayload {
  id?: string | null;
  locked?: boolean | null;
}

interface DiscussionLockMutationResponse {
  lockLockable?: { lockedRecord?: DiscussionLockablePayload | null } | null;
  unlockLockable?: { lockedRecord?: DiscussionLockablePayload | null } | null;
}

const PAGE_INFO_FIELDS = `
  pageInfo {
    hasNextPage
    endCursor
  }
`;

const DISCUSSION_ACTOR_FIELDS = `
  fragment DiscussionActorFields on Actor {
    login
    avatarUrl
    url
  }
`;

const DISCUSSION_REPLY_FIELDS = `
  fragment DiscussionReplyFields on DiscussionComment {
    id
    body
    url
    createdAt
    updatedAt
    isAnswer
    upvoteCount
    viewerHasUpvoted
    author {
      ...DiscussionActorFields
    }
    replyTo {
      id
    }
  }
`;

const DISCUSSION_COMMENT_FIELDS = `
  fragment DiscussionCommentFields on DiscussionComment {
    ...DiscussionReplyFields
    replies(first: ${INITIAL_REPLIES_PAGE_SIZE}) {
      totalCount
      ${PAGE_INFO_FIELDS}
      nodes {
        ...DiscussionReplyFields
      }
    }
  }
`;

const DISCUSSION_PARENT_FIELDS = `
  fragment DiscussionParentFields on Discussion {
    number
    repository {
      name
      owner {
        login
      }
    }
  }
`;

const FETCH_DISCUSSION_QUERY = `
  ${DISCUSSION_ACTOR_FIELDS}
  ${DISCUSSION_REPLY_FIELDS}
  ${DISCUSSION_COMMENT_FIELDS}
  query FetchDiscussion($owner: String!, $repo: String!, $discussionNumber: Int!) {
    repository(owner: $owner, name: $repo) {
      discussion(number: $discussionNumber) {
        id
        number
        title
        body
        url
        createdAt
        updatedAt
        locked
        isAnswered
        upvoteCount
        viewerHasUpvoted
        author {
          ...DiscussionActorFields
        }
        category {
          id
          name
          emoji
          description
          isAnswerable
          slug
        }
        answer {
          ...DiscussionReplyFields
        }
        comments(first: ${DISCUSSION_COMMENTS_PAGE_SIZE}) {
          totalCount
          ${PAGE_INFO_FIELDS}
          nodes {
            ...DiscussionCommentFields
          }
        }
      }
    }
  }
`;

const FETCH_DISCUSSION_COMMENTS_QUERY = `
  ${DISCUSSION_ACTOR_FIELDS}
  ${DISCUSSION_REPLY_FIELDS}
  ${DISCUSSION_COMMENT_FIELDS}
  query FetchDiscussionComments(
    $owner: String!
    $repo: String!
    $discussionNumber: Int!
    $cursor: String
  ) {
    repository(owner: $owner, name: $repo) {
      discussion(number: $discussionNumber) {
        comments(first: ${DISCUSSION_COMMENTS_PAGE_SIZE}, after: $cursor) {
          totalCount
          ${PAGE_INFO_FIELDS}
          nodes {
            ...DiscussionCommentFields
          }
        }
      }
    }
  }
`;

const FETCH_DISCUSSION_COMMENT_REPLIES_QUERY = `
  ${DISCUSSION_ACTOR_FIELDS}
  ${DISCUSSION_REPLY_FIELDS}
  ${DISCUSSION_PARENT_FIELDS}
  query FetchDiscussionCommentReplies($commentId: ID!, $cursor: String) {
    node(id: $commentId) {
      ... on DiscussionComment {
        discussion {
          ...DiscussionParentFields
        }
        replyTo {
          id
        }
        replies(first: ${DISCUSSION_REPLIES_PAGE_SIZE}, after: $cursor) {
          totalCount
          ${PAGE_INFO_FIELDS}
          nodes {
            ...DiscussionReplyFields
          }
        }
      }
    }
  }
`;

const FETCH_DISCUSSION_NODE_ID_QUERY = `
  query FetchDiscussionNodeId($owner: String!, $repo: String!, $discussionNumber: Int!) {
    repository(owner: $owner, name: $repo) {
      discussion(number: $discussionNumber) {
        id
      }
    }
  }
`;

const FETCH_DISCUSSION_REPLY_CONTEXT_QUERY = `
  ${DISCUSSION_PARENT_FIELDS}
  query FetchDiscussionReplyContext(
    $owner: String!
    $repo: String!
    $discussionNumber: Int!
    $commentId: ID!
  ) {
    repository(owner: $owner, name: $repo) {
      discussion(number: $discussionNumber) {
        id
      }
    }
    node(id: $commentId) {
      ... on DiscussionComment {
        discussion {
          ...DiscussionParentFields
        }
        replyTo {
          id
        }
      }
    }
  }
`;

const ADD_DISCUSSION_COMMENT_MUTATION = `
  ${DISCUSSION_ACTOR_FIELDS}
  ${DISCUSSION_REPLY_FIELDS}
  ${DISCUSSION_COMMENT_FIELDS}
  mutation AddDiscussionComment($discussionId: ID!, $body: String!, $replyToId: ID) {
    addDiscussionComment(
      input: { discussionId: $discussionId, body: $body, replyToId: $replyToId }
    ) {
      comment {
        ...DiscussionCommentFields
      }
    }
  }
`;

const MARK_DISCUSSION_COMMENT_AS_ANSWER_MUTATION = `
  mutation MarkDiscussionCommentAsAnswer($id: ID!) {
    markDiscussionCommentAsAnswer(input: { id: $id }) {
      clientMutationId
    }
  }
`;

const UNMARK_DISCUSSION_COMMENT_AS_ANSWER_MUTATION = `
  mutation UnmarkDiscussionCommentAsAnswer($id: ID!) {
    unmarkDiscussionCommentAsAnswer(input: { id: $id }) {
      clientMutationId
    }
  }
`;

const ADD_DISCUSSION_UPVOTE_MUTATION = `
  mutation AddDiscussionUpvote($subjectId: ID!) {
    addUpvote(input: { subjectId: $subjectId }) {
      subject {
        ... on Discussion {
          id
          upvoteCount
          viewerHasUpvoted
        }
        ... on DiscussionComment {
          id
          upvoteCount
          viewerHasUpvoted
        }
      }
    }
  }
`;

const REMOVE_DISCUSSION_UPVOTE_MUTATION = `
  mutation RemoveDiscussionUpvote($subjectId: ID!) {
    removeUpvote(input: { subjectId: $subjectId }) {
      subject {
        ... on Discussion {
          id
          upvoteCount
          viewerHasUpvoted
        }
        ... on DiscussionComment {
          id
          upvoteCount
          viewerHasUpvoted
        }
      }
    }
  }
`;

const LOCK_DISCUSSION_MUTATION = `
  mutation LockDiscussion($lockableId: ID!, $lockReason: LockReason) {
    lockLockable(input: { lockableId: $lockableId, lockReason: $lockReason }) {
      lockedRecord {
        ... on Discussion {
          id
          locked
        }
        ... on Issue {
          id
          locked
        }
      }
    }
  }
`;

const UNLOCK_DISCUSSION_MUTATION = `
  mutation UnlockDiscussion($lockableId: ID!) {
    unlockLockable(input: { lockableId: $lockableId }) {
      lockedRecord {
        ... on Discussion {
          id
          locked
        }
        ... on Issue {
          id
          locked
        }
      }
    }
  }
`;

const DISCUSSION_LOCK_REASON_MAP: Record<DiscussionLockReason, string> = {
  'off-topic': 'OFF_TOPIC',
  'too-heated': 'TOO_HEATED',
  resolved: 'RESOLVED',
  spam: 'SPAM',
};

function throwDiscussionNotFound(): never {
  throw createError({
    statusCode: 404,
    statusMessage: 'Discussion not found',
  });
}

function throwDiscussionCommentNotFound(): never {
  throw createError({
    statusCode: 404,
    statusMessage: 'Discussion comment not found',
  });
}

function requireString(value: unknown, fieldName: string) {
  if (typeof value === 'string' && value.trim()) {
    return value;
  }

  throw createError({
    statusCode: 500,
    statusMessage: `${fieldName} missing from GitHub response`,
  });
}

function requireNumber(value: unknown, fieldName: string) {
  if (typeof value === 'number' && Number.isSafeInteger(value)) {
    return value;
  }

  throw createError({
    statusCode: 500,
    statusMessage: `${fieldName} missing from GitHub response`,
  });
}

function normalizeOptionalString(value: unknown) {
  return typeof value === 'string' && value ? value : undefined;
}

function normalizeActor(actor: DiscussionActorPayload | null | undefined): DiscussionAuthor | null {
  if (!actor?.login) {
    return null;
  }

  return {
    login: actor.login,
    avatarUrl: normalizeOptionalString(actor.avatarUrl),
    url: normalizeOptionalString(actor.url),
  };
}

function normalizeCategory(
  category: DiscussionCategoryPayload | null | undefined
): DiscussionCategory | null {
  if (!category?.id || !category.name) {
    return null;
  }

  return {
    id: category.id,
    name: category.name,
    emoji: normalizeOptionalString(category.emoji),
    description: typeof category.description === 'string' ? category.description : null,
    isAnswerable: Boolean(category.isAnswerable),
    slug: normalizeOptionalString(category.slug),
  };
}

function normalizePageInfo(
  pageInfo: DiscussionPageInfoPayload | null | undefined
): DiscussionPageInfo {
  return {
    hasNextPage: Boolean(pageInfo?.hasNextPage),
    endCursor: typeof pageInfo?.endCursor === 'string' ? pageInfo.endCursor : null,
  };
}

function normalizeConnection<TInput, TOutput>(
  connection: DiscussionConnectionPayload<TInput> | null | undefined,
  normalizeNode: (node: TInput) => TOutput,
  hasNodeId: (node: TInput) => boolean
) {
  const items: TOutput[] = [];

  for (const node of connection?.nodes ?? []) {
    if (node && hasNodeId(node)) {
      items.push(normalizeNode(node));
    }
  }

  return {
    items,
    totalCount: typeof connection?.totalCount === 'number' ? connection.totalCount : items.length,
    pageInfo: normalizePageInfo(connection?.pageInfo),
  };
}

function hasDiscussionReplyId(node: DiscussionReplyPayload) {
  return typeof node.id === 'string' && Boolean(node.id);
}

function normalizeReply(reply: DiscussionReplyPayload): DiscussionReply {
  const nodeId = requireString(reply.id, 'Discussion reply ID');

  return {
    id: nodeId,
    nodeId,
    body: typeof reply.body === 'string' ? reply.body : '',
    url: normalizeOptionalString(reply.url),
    createdAt: normalizeOptionalString(reply.createdAt),
    updatedAt: normalizeOptionalString(reply.updatedAt),
    author: normalizeActor(reply.author),
    isAnswer: Boolean(reply.isAnswer),
    replyToId: typeof reply.replyTo?.id === 'string' ? reply.replyTo.id : null,
    upvoteCount:
      typeof reply.upvoteCount === 'number' && Number.isFinite(reply.upvoteCount)
        ? reply.upvoteCount
        : 0,
    viewerHasUpvoted: Boolean(reply.viewerHasUpvoted),
  };
}

function normalizeReplies(
  replies: DiscussionConnectionPayload<DiscussionReplyPayload> | null | undefined
): DiscussionRepliesPayload {
  return normalizeConnection(replies, normalizeReply, hasDiscussionReplyId);
}

function normalizeComment(comment: DiscussionCommentPayload): DiscussionComment {
  return {
    ...normalizeReply(comment),
    replies: normalizeReplies(comment.replies),
  };
}

function normalizeComments(
  comments: DiscussionConnectionPayload<DiscussionCommentPayload> | null | undefined
): DiscussionCommentsPayload {
  return normalizeConnection(comments, normalizeComment, hasDiscussionReplyId);
}

function normalizeDiscussion(
  discussion: DiscussionPayload,
  owner: string,
  repo: string
): DiscussionDetailPayload {
  const nodeId = requireString(discussion.id, 'Discussion ID');

  return {
    id: nodeId,
    nodeId,
    owner,
    repo,
    repository_url: `https://api.github.com/repos/${owner}/${repo}`,
    number: requireNumber(discussion.number, 'Discussion number'),
    title: typeof discussion.title === 'string' ? discussion.title : '',
    body: typeof discussion.body === 'string' ? discussion.body : '',
    url: normalizeOptionalString(discussion.url),
    createdAt: normalizeOptionalString(discussion.createdAt),
    updatedAt: normalizeOptionalString(discussion.updatedAt),
    author: normalizeActor(discussion.author),
    category: normalizeCategory(discussion.category),
    isAnswered: Boolean(discussion.isAnswered),
    answer: discussion.answer?.id ? normalizeReply(discussion.answer) : null,
    locked: Boolean(discussion.locked),
    upvoteCount:
      typeof discussion.upvoteCount === 'number' && Number.isFinite(discussion.upvoteCount)
        ? discussion.upvoteCount
        : 0,
    viewerHasUpvoted: Boolean(discussion.viewerHasUpvoted),
    comments: normalizeComments(discussion.comments),
  };
}

/** Validate that a value is a non-empty string suitable for use as a GitHub GraphQL node ID. */
export function validateDiscussionNodeId(value: unknown, fieldName = 'Discussion node ID') {
  const nodeId = typeof value === 'string' ? value.trim() : '';

  if (!nodeId) {
    throw createError({
      statusCode: 400,
      statusMessage: `${fieldName} is required`,
    });
  }

  return nodeId;
}

function isSameRouteSegment(left: string | null | undefined, right: string) {
  return typeof left === 'string' && left.toLowerCase() === right.toLowerCase();
}

function assertDiscussionCommentBelongsToRoute(
  discussion: DiscussionParentPayload | null | undefined,
  owner: string,
  repo: string,
  discussionNumber: number
) {
  if (
    discussion?.number === discussionNumber &&
    isSameRouteSegment(discussion.repository?.owner?.login, owner) &&
    isSameRouteSegment(discussion.repository?.name, repo)
  ) {
    return;
  }

  throwDiscussionCommentNotFound();
}

function assertTopLevelDiscussionComment(replyTo: { id?: string | null } | null | undefined) {
  if (!replyTo?.id) {
    return;
  }

  throw createError({
    statusCode: 400,
    statusMessage: 'Discussion comment replies only support top-level comments',
  });
}

/** Fetch full detail of a single GitHub Discussion by number, including the accepted answer. */
export async function fetchDiscussion(
  octokit: GitHubClient,
  owner: string,
  repo: string,
  discussionNumber: number
): Promise<DiscussionDetailPayload> {
  const response = await octokit.graphql<FetchDiscussionResponse>(FETCH_DISCUSSION_QUERY, {
    owner,
    repo,
    discussionNumber,
  });
  const discussion = response.repository?.discussion;

  if (!discussion) {
    throwDiscussionNotFound();
  }

  return normalizeDiscussion(discussion, owner, repo);
}

/** Fetch a page of top-level comments on a GitHub Discussion. */
export async function fetchDiscussionComments(
  octokit: GitHubClient,
  owner: string,
  repo: string,
  discussionNumber: number,
  cursor?: string
): Promise<DiscussionCommentsPayload> {
  const response = await octokit.graphql<FetchDiscussionCommentsResponse>(
    FETCH_DISCUSSION_COMMENTS_QUERY,
    {
      owner,
      repo,
      discussionNumber,
      cursor: cursor || null,
    }
  );
  const discussion = response.repository?.discussion;

  if (!discussion) {
    throwDiscussionNotFound();
  }

  return normalizeComments(discussion.comments);
}

/** Fetch the GraphQL node ID for a discussion by its number. */
export async function fetchDiscussionNodeId(
  octokit: GitHubClient,
  owner: string,
  repo: string,
  discussionNumber: number
): Promise<string> {
  const response = await octokit.graphql<FetchDiscussionNodeIdResponse>(
    FETCH_DISCUSSION_NODE_ID_QUERY,
    {
      owner,
      repo,
      discussionNumber,
    }
  );
  const discussion = response.repository?.discussion;

  if (!discussion) {
    throwDiscussionNotFound();
  }

  return requireString(discussion.id, 'Discussion ID');
}

/** Resolve both the discussion ID and the parent comment ID for replying to a specific comment. */
export async function fetchDiscussionReplyContext(
  octokit: GitHubClient,
  owner: string,
  repo: string,
  discussionNumber: number,
  commentId: string
): Promise<{ discussionId: string; replyToId: string }> {
  const replyToId = validateDiscussionNodeId(commentId, 'Discussion comment ID');
  const response = await octokit.graphql<FetchDiscussionReplyContextResponse>(
    FETCH_DISCUSSION_REPLY_CONTEXT_QUERY,
    {
      owner,
      repo,
      discussionNumber,
      commentId: replyToId,
    }
  );
  const discussion = response.repository?.discussion;

  if (!discussion) {
    throwDiscussionNotFound();
  }

  assertDiscussionCommentBelongsToRoute(response.node?.discussion, owner, repo, discussionNumber);
  assertTopLevelDiscussionComment(response.node?.replyTo);

  return {
    discussionId: requireString(discussion.id, 'Discussion ID'),
    replyToId,
  };
}

/** Fetch paginated replies to a specific top-level discussion comment. */
export async function fetchDiscussionCommentReplies(
  octokit: GitHubClient,
  owner: string,
  repo: string,
  discussionNumber: number,
  commentId: string,
  cursor?: string
): Promise<DiscussionRepliesPayload> {
  const response = await octokit.graphql<FetchDiscussionCommentRepliesResponse>(
    FETCH_DISCUSSION_COMMENT_REPLIES_QUERY,
    {
      commentId: validateDiscussionNodeId(commentId, 'Discussion comment ID'),
      cursor: cursor || null,
    }
  );

  if (!response.node?.replies) {
    throwDiscussionCommentNotFound();
  }

  assertDiscussionCommentBelongsToRoute(response.node.discussion, owner, repo, discussionNumber);
  assertTopLevelDiscussionComment(response.node.replyTo);

  return normalizeReplies(response.node.replies);
}

/** Post a new top-level comment on a GitHub Discussion. */
export async function addDiscussionComment(
  octokit: GitHubClient,
  discussionId: string,
  body: string
): Promise<DiscussionComment> {
  const response = await octokit.graphql<AddDiscussionCommentResponse>(
    ADD_DISCUSSION_COMMENT_MUTATION,
    {
      discussionId: validateDiscussionNodeId(discussionId, 'Discussion ID'),
      body,
      replyToId: null,
    }
  );
  const comment = response.addDiscussionComment?.comment;

  if (!comment?.id) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Created discussion comment missing from GitHub response',
    });
  }

  return normalizeComment(comment);
}

/** Post a reply to an existing discussion comment. */
export async function addDiscussionReply(
  octokit: GitHubClient,
  discussionId: string,
  replyToId: string,
  body: string
): Promise<DiscussionReply> {
  const response = await octokit.graphql<AddDiscussionCommentResponse>(
    ADD_DISCUSSION_COMMENT_MUTATION,
    {
      discussionId: validateDiscussionNodeId(discussionId, 'Discussion ID'),
      body,
      replyToId: validateDiscussionNodeId(replyToId, 'Discussion comment ID'),
    }
  );
  const reply = response.addDiscussionComment?.comment;

  if (!reply?.id) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Created discussion reply missing from GitHub response',
    });
  }

  return normalizeReply(reply);
}

/** Mark or unmark a discussion comment as the accepted answer. */
export async function setDiscussionCommentAnswer(
  octokit: GitHubClient,
  commentId: string,
  answered: boolean
): Promise<{ id: string; isAnswer: boolean }> {
  const id = validateDiscussionNodeId(commentId, 'Discussion comment ID');
  const mutation = answered
    ? MARK_DISCUSSION_COMMENT_AS_ANSWER_MUTATION
    : UNMARK_DISCUSSION_COMMENT_AS_ANSWER_MUTATION;

  await octokit.graphql<DiscussionCommentAnswerMutationResponse>(mutation, { id });

  return { id, isAnswer: answered };
}

/** Add or remove the viewer's upvote on a discussion or discussion comment. */
export async function setDiscussionUpvote(
  octokit: GitHubClient,
  subjectId: string,
  upvoted: boolean
): Promise<{ id: string; upvoteCount: number; viewerHasUpvoted: boolean }> {
  const nodeId = validateDiscussionNodeId(subjectId, 'Discussion upvote subject ID');
  const response = await octokit.graphql<DiscussionUpvoteMutationResponse>(
    upvoted ? ADD_DISCUSSION_UPVOTE_MUTATION : REMOVE_DISCUSSION_UPVOTE_MUTATION,
    { subjectId: nodeId }
  );
  const subject = upvoted ? response.addUpvote?.subject : response.removeUpvote?.subject;

  if (!subject?.id) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Updated discussion upvote subject missing from GitHub response',
    });
  }

  return {
    id: requireString(subject.id, 'Discussion upvote subject ID'),
    upvoteCount:
      typeof subject.upvoteCount === 'number' && Number.isFinite(subject.upvoteCount)
        ? subject.upvoteCount
        : 0,
    viewerHasUpvoted: Boolean(subject.viewerHasUpvoted),
  };
}

/** Lock or unlock a discussion with an optional GitHub lock reason. */
export async function setDiscussionLocked(
  octokit: GitHubClient,
  discussionId: string,
  locked: boolean,
  reason?: DiscussionLockReason
): Promise<{ id: string; locked: boolean }> {
  const lockableId = validateDiscussionNodeId(discussionId, 'Discussion ID');
  const response = locked
    ? await octokit.graphql<DiscussionLockMutationResponse>(LOCK_DISCUSSION_MUTATION, {
        lockableId,
        ...(reason ? { lockReason: DISCUSSION_LOCK_REASON_MAP[reason] } : {}),
      })
    : await octokit.graphql<DiscussionLockMutationResponse>(UNLOCK_DISCUSSION_MUTATION, {
        lockableId,
      });
  const lockedRecord = locked
    ? response.lockLockable?.lockedRecord
    : response.unlockLockable?.lockedRecord;

  if (!lockedRecord?.id) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Locked discussion missing from GitHub response',
    });
  }

  return {
    id: requireString(lockedRecord.id, 'Discussion ID'),
    locked: Boolean(lockedRecord.locked),
  };
}
