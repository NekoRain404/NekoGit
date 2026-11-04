<!-- Discussion Detail — Discussion detail page: title, comments, replies, and sidebar metadata. -->
<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type {
  DiscussionComment,
  DiscussionCommentsPayload,
  DiscussionDetailPayload,
  DiscussionPageInfo,
  DiscussionRepliesPayload,
  DiscussionReply,
} from '#shared/types/discussions';
import type { DiscussionLockReason } from '#shared/utils/discussion-actions';
import DiscussionActions from '~/components/dashboard/discussion/DiscussionActions.vue';
import DiscussionAnswerCard from '~/components/dashboard/discussion/DiscussionAnswerCard.vue';
import DiscussionComments from '~/components/dashboard/discussion/DiscussionComments.vue';
import DiscussionComposer from '~/components/dashboard/discussion/DiscussionComposer.vue';
import DiscussionHeader from '~/components/dashboard/discussion/DiscussionHeader.vue';
import getFetchErrorMessage from '~/utils/getFetchErrorMessage';

const props = defineProps<{
  discussion: DiscussionDetailPayload;
}>();

defineEmits<{
  (e: 'switch-issue', owner: string, repo: string, issueNumber: number): void;
  (e: 'switch-pull-request', owner: string, repo: string, pullNumber: number): void;
  (e: 'switch-discussion', owner: string, repo: string, discussionNumber: number): void;
}>();

const EMPTY_PAGE_INFO: DiscussionPageInfo = {
  hasNextPage: false,
  endCursor: null,
};

const { t } = useI18n();
const apiFetch = useNekoGitApiFetch();
const { isScrolling: isSidebarScrolling, onScroll: onSidebarScroll } = useAutoHideScrollState();

const discussionState = shallowRef<DiscussionDetailPayload>(cloneDiscussion(props.discussion));
const comments = shallowRef<DiscussionComment[]>([]);
const commentsTotalCount = shallowRef(0);
const commentsPageInfo = shallowRef<DiscussionPageInfo>({ ...EMPTY_PAGE_INFO });
const loadingComments = shallowRef(false);
const loadingMoreComments = shallowRef(false);
const commentsError = shallowRef('');
const submittingComment = shallowRef(false);
const loadingReplyIds = shallowRef(new Set<string>());
const submittingReplyIds = shallowRef(new Set<string>());
const replyErrors = shallowRef(new Map<string, string>());
const discussionUpvotePending = shallowRef(false);
const discussionUpvoteError = shallowRef('');
const lockPending = shallowRef(false);
const lockError = shallowRef('');
const pendingCommentUpvoteIds = shallowRef(new Set<string>());
const pendingCommentAnswerIds = shallowRef(new Set<string>());
const commentActionErrors = shallowRef(new Map<string, string>());

const displayDiscussion = computed<DiscussionDetailPayload>(() => ({
  ...discussionState.value,
  comments: {
    items: comments.value,
    totalCount: commentsTotalCount.value,
    pageInfo: commentsPageInfo.value,
  },
}));

const repoOwner = computed(() => displayDiscussion.value.owner ?? '');
const repoName = computed(() => displayDiscussion.value.repo ?? '');
const discussionNumber = computed(() => displayDiscussion.value.number);

const discussionReadApiBase = computed(() => {
  if (!repoOwner.value || !repoName.value || !discussionNumber.value) return '';
  return `/api/discussions/${encodeURIComponent(repoOwner.value)}/${encodeURIComponent(repoName.value)}/${discussionNumber.value}`;
});

const discussionWriteApiBase = computed(() => {
  if (!repoOwner.value || !repoName.value || !discussionNumber.value) return '';
  return `/api/repos/${encodeURIComponent(repoOwner.value)}/${encodeURIComponent(repoName.value)}/discussions/${discussionNumber.value}`;
});

const isDiscussionLocked = computed(() => displayDiscussion.value.locked);
const canComment = computed(
  () => !isDiscussionLocked.value && Boolean(discussionWriteApiBase.value)
);
const canReply = computed(() => canComment.value);
const canMarkAnswer = computed(() => Boolean(displayDiscussion.value.category?.isAnswerable));

const visibleAnswer = computed(() => {
  const answer = displayDiscussion.value.answer;
  if (!answer || commentsContainReply(comments.value, answer)) return null;
  return answer;
});

function cloneReply(reply: DiscussionReply): DiscussionReply {
  return { ...reply, author: reply.author ? { ...reply.author } : null };
}

function cloneReplies(replies: DiscussionRepliesPayload): DiscussionRepliesPayload {
  return {
    items: replies.items.map(cloneReply),
    totalCount: replies.totalCount,
    pageInfo: { ...replies.pageInfo },
  };
}

function cloneComment(comment: DiscussionComment): DiscussionComment {
  return {
    ...cloneReply(comment),
    replies: cloneReplies(comment.replies),
  };
}

function cloneComments(payload: DiscussionCommentsPayload): DiscussionCommentsPayload {
  return {
    items: payload.items.map(cloneComment),
    totalCount: payload.totalCount,
    pageInfo: { ...payload.pageInfo },
  };
}

function cloneDiscussion(discussion: DiscussionDetailPayload): DiscussionDetailPayload {
  return {
    ...discussion,
    author: discussion.author ? { ...discussion.author } : null,
    category: discussion.category ? { ...discussion.category } : null,
    answer: discussion.answer ? cloneReply(discussion.answer) : null,
    comments: cloneComments(discussion.comments),
  };
}

function appendUniqueById<T extends { id: string }>(currentItems: T[], nextItems: T[]) {
  const seen = new Set(currentItems.map((item) => item.id));
  const uniqueNext = nextItems.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });

  return [...currentItems, ...uniqueNext];
}

function isSameDiscussionNode(left: DiscussionReply, right: DiscussionReply) {
  return left.id === right.id || left.nodeId === right.nodeId;
}

function commentsContainReply(items: DiscussionComment[], target: DiscussionReply) {
  return items.some((comment) => {
    if (isSameDiscussionNode(comment, target)) return true;
    return comment.replies.items.some((reply) => isSameDiscussionNode(reply, target));
  });
}

function setIdInSet(source: typeof loadingReplyIds, id: string, active: boolean) {
  const nextIds = new Set(source.value);

  if (active) {
    nextIds.add(id);
  } else {
    nextIds.delete(id);
  }

  source.value = nextIds;
}

function setReplyError(commentId: string, error: string) {
  const nextErrors = new Map(replyErrors.value);

  if (error) {
    nextErrors.set(commentId, error);
  } else {
    nextErrors.delete(commentId);
  }

  replyErrors.value = nextErrors;
}

function setCommentActionError(commentId: string, error: string) {
  const nextErrors = new Map(commentActionErrors.value);

  if (error) {
    nextErrors.set(commentId, error);
  } else {
    nextErrors.delete(commentId);
  }

  commentActionErrors.value = nextErrors;
}

function updateComment(
  commentId: string,
  updater: (comment: DiscussionComment) => DiscussionComment
) {
  comments.value = comments.value.map((comment) =>
    comment.id === commentId ? updater(comment) : comment
  );
}

function resetDiscussionState(discussion: DiscussionDetailPayload) {
  const nextDiscussion = cloneDiscussion(discussion);
  discussionState.value = nextDiscussion;
  comments.value = nextDiscussion.comments.items;
  commentsTotalCount.value = nextDiscussion.comments.totalCount;
  commentsPageInfo.value = nextDiscussion.comments.pageInfo;
  loadingComments.value = false;
  loadingMoreComments.value = false;
  commentsError.value = '';
  submittingComment.value = false;
  loadingReplyIds.value = new Set();
  submittingReplyIds.value = new Set();
  replyErrors.value = new Map();
  discussionUpvotePending.value = false;
  discussionUpvoteError.value = '';
  lockPending.value = false;
  lockError.value = '';
  pendingCommentUpvoteIds.value = new Set();
  pendingCommentAnswerIds.value = new Set();
  commentActionErrors.value = new Map();
}

async function loadMoreComments() {
  if (
    !discussionReadApiBase.value ||
    !commentsPageInfo.value.hasNextPage ||
    loadingMoreComments.value
  ) {
    return;
  }

  loadingMoreComments.value = true;
  commentsError.value = '';

  try {
    const payload = await apiFetch<DiscussionCommentsPayload>(
      `${discussionReadApiBase.value}/comments`,
      {
        query: {
          cursor: commentsPageInfo.value.endCursor || undefined,
        },
      }
    );

    comments.value = appendUniqueById(comments.value, payload.items.map(cloneComment));
    commentsTotalCount.value = payload.totalCount;
    commentsPageInfo.value = { ...payload.pageInfo };
  } catch (error) {
    commentsError.value = getFetchErrorMessage(error, t('discussionDetail.commentsLoadFailed'));
  } finally {
    loadingMoreComments.value = false;
  }
}

async function loadMoreReplies(comment: DiscussionComment) {
  if (
    !discussionReadApiBase.value ||
    !comment.replies.pageInfo.hasNextPage ||
    loadingReplyIds.value.has(comment.id)
  ) {
    return;
  }

  setIdInSet(loadingReplyIds, comment.id, true);
  setReplyError(comment.id, '');

  try {
    const payload = await apiFetch<DiscussionRepliesPayload>(
      `${discussionReadApiBase.value}/comments/${encodeURIComponent(comment.id)}/replies`,
      {
        query: {
          cursor: comment.replies.pageInfo.endCursor || undefined,
        },
      }
    );

    updateComment(comment.id, (currentComment) => ({
      ...currentComment,
      replies: {
        items: appendUniqueById(currentComment.replies.items, payload.items.map(cloneReply)),
        totalCount: payload.totalCount,
        pageInfo: { ...payload.pageInfo },
      },
    }));
  } catch (error) {
    setReplyError(comment.id, getFetchErrorMessage(error, t('discussionDetail.repliesLoadFailed')));
  } finally {
    setIdInSet(loadingReplyIds, comment.id, false);
  }
}

async function submitComment(body: string) {
  if (isDiscussionLocked.value) {
    throw new Error(t('discussionDetail.lockedCommentNotice'));
  }

  if (!discussionWriteApiBase.value) {
    throw new Error(t('discussionDetail.submitCommentFailed'));
  }

  submittingComment.value = true;

  try {
    const payload = await apiFetch<{ comment?: DiscussionComment }>(
      `${discussionWriteApiBase.value}/comments`,
      {
        method: 'POST',
        body: { body },
      }
    );

    if (!payload.comment) {
      throw new Error(t('discussionDetail.submitCommentFailed'));
    }

    comments.value = appendUniqueById(comments.value, [cloneComment(payload.comment)]);
    commentsTotalCount.value = Math.max(commentsTotalCount.value + 1, comments.value.length);
  } catch (error) {
    throw new Error(getFetchErrorMessage(error, t('discussionDetail.submitCommentFailed')));
  } finally {
    submittingComment.value = false;
  }
}

async function submitReply(comment: DiscussionComment, body: string) {
  if (isDiscussionLocked.value) {
    throw new Error(t('discussionDetail.lockedCommentNotice'));
  }

  if (!discussionWriteApiBase.value) {
    throw new Error(t('discussionDetail.submitReplyFailed'));
  }

  setIdInSet(submittingReplyIds, comment.id, true);
  setReplyError(comment.id, '');

  try {
    const payload = await apiFetch<{ reply?: DiscussionReply }>(
      `${discussionWriteApiBase.value}/comments/${encodeURIComponent(comment.id)}/replies`,
      {
        method: 'POST',
        body: { body },
      }
    );

    if (!payload.reply) {
      throw new Error(t('discussionDetail.submitReplyFailed'));
    }

    updateComment(comment.id, (currentComment) => ({
      ...currentComment,
      replies: {
        ...currentComment.replies,
        items: appendUniqueById(currentComment.replies.items, [cloneReply(payload.reply!)]),
        totalCount: Math.max(
          currentComment.replies.totalCount + 1,
          currentComment.replies.items.length + 1
        ),
      },
    }));
  } catch (error) {
    const message = getFetchErrorMessage(error, t('discussionDetail.submitReplyFailed'));
    setReplyError(comment.id, message);
    throw new Error(message);
  } finally {
    setIdInSet(submittingReplyIds, comment.id, false);
  }
}

/** Upvote payload returned by the discussion upvote routes. */
interface DiscussionUpvotePayload {
  id: string;
  upvoteCount: number;
  viewerHasUpvoted: boolean;
}

function applyCommentUpvote(commentId: string, payload: DiscussionUpvotePayload) {
  comments.value = comments.value.map((comment) =>
    comment.id === commentId
      ? {
          ...comment,
          upvoteCount: payload.upvoteCount,
          viewerHasUpvoted: payload.viewerHasUpvoted,
        }
      : comment
  );

  const answer = discussionState.value.answer;

  if (answer && (answer.id === commentId || answer.nodeId === commentId)) {
    discussionState.value = {
      ...discussionState.value,
      answer: {
        ...answer,
        upvoteCount: payload.upvoteCount,
        viewerHasUpvoted: payload.viewerHasUpvoted,
      },
    };
  }
}

async function toggleDiscussionUpvote() {
  if (discussionUpvotePending.value) return;

  if (!discussionReadApiBase.value) {
    discussionUpvoteError.value = t('discussionDetail.upvoteFailed');
    return;
  }

  const upvoted = !displayDiscussion.value.viewerHasUpvoted;
  discussionUpvotePending.value = true;
  discussionUpvoteError.value = '';

  try {
    const payload = await apiFetch<DiscussionUpvotePayload>(
      `${discussionReadApiBase.value}/upvote`,
      {
        method: 'POST',
        body: { upvoted },
      }
    );

    discussionState.value = {
      ...discussionState.value,
      upvoteCount: payload.upvoteCount,
      viewerHasUpvoted: payload.viewerHasUpvoted,
    };
  } catch (error) {
    discussionUpvoteError.value = getFetchErrorMessage(error, t('discussionDetail.upvoteFailed'));
  } finally {
    discussionUpvotePending.value = false;
  }
}

async function toggleCommentUpvote(comment: DiscussionComment) {
  if (pendingCommentUpvoteIds.value.has(comment.id)) return;

  if (!discussionReadApiBase.value) {
    setCommentActionError(comment.id, t('discussionDetail.upvoteFailed'));
    return;
  }

  const upvoted = !comment.viewerHasUpvoted;
  setIdInSet(pendingCommentUpvoteIds, comment.id, true);
  setCommentActionError(comment.id, '');

  try {
    const payload = await apiFetch<DiscussionUpvotePayload>(
      `${discussionReadApiBase.value}/comments/${encodeURIComponent(comment.id)}/upvote`,
      {
        method: 'POST',
        body: { upvoted },
      }
    );

    applyCommentUpvote(comment.id, payload);
  } catch (error) {
    setCommentActionError(
      comment.id,
      getFetchErrorMessage(error, t('discussionDetail.upvoteFailed'))
    );
  } finally {
    setIdInSet(pendingCommentUpvoteIds, comment.id, false);
  }
}

function applyCommentAnswer(commentId: string, isAnswer: boolean) {
  const target = comments.value.find((comment) => comment.id === commentId);

  comments.value = comments.value.map((comment) => {
    if (comment.id === commentId) {
      return { ...comment, isAnswer };
    }

    if (isAnswer && comment.isAnswer) {
      return { ...comment, isAnswer: false };
    }

    return comment;
  });

  if (isAnswer && target) {
    discussionState.value = {
      ...discussionState.value,
      isAnswered: true,
      answer: cloneReply(target),
    };
    return;
  }

  const currentAnswer = discussionState.value.answer;

  if (!currentAnswer || currentAnswer.id === commentId || currentAnswer.nodeId === commentId) {
    discussionState.value = {
      ...discussionState.value,
      isAnswered: false,
      answer: null,
    };
  }
}

async function toggleCommentAnswer(comment: DiscussionComment) {
  if (pendingCommentAnswerIds.value.has(comment.id)) return;

  if (!discussionReadApiBase.value) {
    setCommentActionError(comment.id, t('discussionDetail.answerUpdateFailed'));
    return;
  }

  const answered = !comment.isAnswer;
  setIdInSet(pendingCommentAnswerIds, comment.id, true);
  setCommentActionError(comment.id, '');

  try {
    const payload = await apiFetch<{ id: string; isAnswer: boolean }>(
      `${discussionReadApiBase.value}/comments/${encodeURIComponent(comment.id)}/answer`,
      {
        method: 'POST',
        body: { answered },
      }
    );

    applyCommentAnswer(comment.id, payload.isAnswer);
  } catch (error) {
    setCommentActionError(
      comment.id,
      getFetchErrorMessage(error, t('discussionDetail.answerUpdateFailed'))
    );
  } finally {
    setIdInSet(pendingCommentAnswerIds, comment.id, false);
  }
}

async function submitDiscussionLock(locked: boolean, reason?: DiscussionLockReason) {
  if (lockPending.value) return;

  const fallbackMessage = t(
    locked ? 'discussionDetail.lockFailed' : 'discussionDetail.unlockFailed'
  );

  if (!discussionReadApiBase.value) {
    lockError.value = fallbackMessage;
    throw new Error(fallbackMessage);
  }

  lockPending.value = true;
  lockError.value = '';

  try {
    const payload = await apiFetch<{ id: string; locked: boolean }>(
      `${discussionReadApiBase.value}/lock`,
      {
        method: 'POST',
        body: {
          locked,
          ...(reason ? { reason } : {}),
        },
      }
    );

    discussionState.value = {
      ...discussionState.value,
      locked: payload.locked,
    };
  } catch (error) {
    lockError.value = getFetchErrorMessage(error, fallbackMessage);
    throw new Error(lockError.value);
  } finally {
    lockPending.value = false;
  }
}

watch(
  () => props.discussion,
  (discussion) => resetDiscussionState(discussion),
  { immediate: true }
);
</script>

<template>
  <div class="detail-scroll">
    <div class="columns">
      <div class="column detail-main-column">
        <DiscussionHeader
          :discussion="displayDiscussion"
          :repo-owner="repoOwner"
          :repo-name="repoName"
          :upvote-pending="discussionUpvotePending"
          :upvote-error="discussionUpvoteError"
          @toggle-upvote="toggleDiscussionUpvote"
        />

        <DiscussionAnswerCard
          v-if="visibleAnswer"
          :answer="visibleAnswer"
          :repo-owner="repoOwner"
          :repo-name="repoName"
        />

        <DiscussionComments
          :comments="comments"
          :total-count="commentsTotalCount"
          :repo-owner="repoOwner"
          :repo-name="repoName"
          :can-reply="canReply"
          :can-mark-answer="canMarkAnswer"
          :loading="loadingComments"
          :loading-more="loadingMoreComments"
          :has-next-page="commentsPageInfo.hasNextPage"
          :error="commentsError"
          :reply-errors="replyErrors"
          :loading-reply-ids="loadingReplyIds"
          :submitting-reply-ids="submittingReplyIds"
          :pending-upvote-ids="pendingCommentUpvoteIds"
          :pending-answer-ids="pendingCommentAnswerIds"
          :action-errors="commentActionErrors"
          :submit-reply="submitReply"
          :upvote-comment="toggleCommentUpvote"
          :toggle-answer="toggleCommentAnswer"
          @load-more-comments="loadMoreComments"
          @load-more-replies="loadMoreReplies"
        />

        <DiscussionComposer
          v-if="canComment"
          class="discussion-detail__composer"
          :repo-owner="repoOwner"
          :repo-name="repoName"
          :placeholder="t('discussionDetail.commentPlaceholder')"
          :submit-label="t('discussionDetail.submitComment')"
          :submitting-label="t('discussionDetail.submittingComment')"
          :submitting="submittingComment"
          :submit="submitComment"
        />

        <p
          v-else
          class="notification is-warning is-light discussion-detail__composer discussion-detail__locked-message"
        >
          {{ t('discussionDetail.lockedCommentNotice') }}
        </p>
      </div>

      <div class="column detail-sidebar-column">
        <div
          class="sidebar-scroll"
          :class="{ 'sidebar-scroll--active': isSidebarScrolling }"
          @scroll="onSidebarScroll"
        >
          <DiscussionActions
            :discussion="displayDiscussion"
            :lock-pending="lockPending"
            :lock-error="lockError"
            :submit-lock="submitDiscussionLock"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.detail-scroll {
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.detail-scroll :deep(.columns) {
  height: 100%;
  min-height: 0;
  align-items: stretch;
  margin-bottom: 0;
}

.detail-scroll :deep(.detail-main-column) {
  height: 100%;
  min-height: 0;
  overflow-y: auto;
  flex: none;
  width: 72%;
}

.detail-scroll :deep(.detail-sidebar-column) {
  height: 100%;
  min-height: 0;
  overflow: hidden;
  flex: none;
  width: 28%;
  padding-right: 1rem;
}

.sidebar-scroll {
  height: 100%;
  overflow-y: auto;
  padding-right: 0.75rem;
  scrollbar-gutter: stable;
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
  transition: scrollbar-color 0.3s ease;

  &:hover,
  &--active {
    scrollbar-color: var(--nekogit-scrollbar-thumb) transparent;
  }

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background-color: transparent;
    border-radius: 3px;
    transition: background-color 0.3s ease;
  }

  &:hover::-webkit-scrollbar-thumb,
  &--active::-webkit-scrollbar-thumb {
    background-color: var(--nekogit-scrollbar-thumb);
  }
}

.discussion-detail__composer {
  position: sticky;
  bottom: 0;
  padding-top: 0.5rem;
  z-index: 6;
}

@media (max-width: 1024px) {
  .detail-scroll {
    overflow-y: auto;
  }

  .detail-scroll :deep(.columns) {
    display: block;
    height: auto;
  }

  .detail-scroll :deep(.detail-main-column),
  .detail-scroll :deep(.detail-sidebar-column) {
    width: 100%;
    height: auto;
    overflow: visible;
  }

  .detail-scroll :deep(.detail-sidebar-column) {
    padding-right: 0.75rem;
  }
}
</style>
