<!-- PRTimeline Events — Activity feed that renders the full ordered list of PR timeline events. -->
<template>
  <div>
    <div class="mb-4 is-flex is-align-items-center">
      <span class="is-size-5 has-text-weight-semibold ml-2 mr-4">{{
        t('issueDetail.activity')
      }}</span>
      <div v-if="loading" class="is-flex is-justify-content-center">
        <LoadingIcon class="icon" />
        <span class="ml-2 is-size-7 has-text-grey">{{ t('issueDetail.loadingTimelines') }}</span>
      </div>
    </div>

    <div v-if="processedTimeline.length > 0">
      <div v-for="item in processedTimeline" :key="item.renderKey" class="mb-4">
        <PRTimelineCommentCard
          v-if="item.kind === 'comment' || item.kind === 'review-comment'"
          :item="item"
          :empty-text="t('issueDetail.noCommentBody')"
          :repo-owner="repoOwner"
          :repo-name="repoName"
        />

        <PRTimelineReviewCard
          v-else-if="item.kind === 'review'"
          :item="item"
          :repo-owner="repoOwner"
          :repo-name="repoName"
          :can-dismiss-review="canDismissReview"
          :dismissing-review-id="dismissingReviewId"
          :review-dismiss-result="reviewDismissResult"
          :resolving-review-thread-id="resolvingReviewThreadId"
          :replying-review-thread-id="replyingReviewThreadId"
          :review-thread-reply-result="reviewThreadReplyResult"
          @toggle-review-thread="emit('toggle-review-thread', $event.threadId, $event.resolved)"
          @reply-to-review-thread="emit('reply-to-review-thread', $event)"
          @dismiss-review="emit('dismiss-review', $event)"
        />

        <PRTimelineCommitCard
          v-else-if="item.kind === 'commit'"
          :item="item"
          :repo-owner="repoOwner"
          :repo-name="repoName"
          :pull-number="pullNumber"
        />

        <PRTimelineMergeCard
          v-else-if="item.kind === 'event' && item.eventType === 'merged'"
          :item="item"
          :repo-owner="repoOwner"
          :repo-name="repoName"
        />

        <div v-else class="mx-2">
          <TimelineEventActorRow :actor="item.actor">
            <PRTimelineEventBody
              :item="item"
              :repo-owner="repoOwner"
              :repo-name="repoName"
              @switch-issue="handleSwitchIssue"
              @switch-pull-request="handleSwitchPullRequest"
            />
          </TimelineEventActorRow>
        </div>
      </div>
    </div>

    <div v-else-if="!loading" class="has-text-grey is-size-7">
      {{ t('issueDetail.noActivity') }}
    </div>

    <div
      v-if="hasNextPage && processedTimeline.length > 0"
      class="mt-4 is-flex is-justify-content-center"
    >
      <button
        class="button is-light is-small"
        type="button"
        :class="{ 'is-loading': loadingMore }"
        :disabled="loadingMore"
        @click="emit('load-more')"
      >
        {{ loadingMore ? t('issueDetail.loadingMore') : t('issueDetail.loadMore') }}
      </button>
    </div>

    <CommentComposer
      class="pr-timeline-events__composer mt-4"
      :repo-owner="repoOwner"
      :repo-name="repoName"
      :item-number="pullNumber"
      @comment-created="emit('comment-created', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import PRTimelineCommentCard from '~/components/dashboard/pr/PRTimelineCommentCard.vue';
import PRTimelineCommitCard from '~/components/dashboard/pr/PRTimelineCommitCard.vue';
import PRTimelineEventBody from '~/components/dashboard/pr/PRTimelineEventBody.vue';
import PRTimelineMergeCard from '~/components/dashboard/pr/PRTimelineMergeCard.vue';
import PRTimelineReviewCard from '~/components/dashboard/pr/PRTimelineReviewCard.vue';
import CommentComposer from '~/components/dashboard/timeline/CommentComposer.vue';
import TimelineEventActorRow from '~/components/dashboard/timeline/TimelineEventActorRow.vue';
import LoadingIcon from '~/components/ui/LoadingIcon.vue';
import { usePRTimelineEvents, type PRTimelineItem } from '~/composables/usePRTimelineEvents';

/** Result of a review thread reply submission. */
interface ReviewThreadReplyResult {
  threadId: string;
  success: boolean;
  error?: string;
}

/** Result of a review dismissal submission. */
interface ReviewDismissResult {
  reviewId: string;
  success: boolean;
  error?: string;
}

const props = defineProps<{
  timeline: PRTimelineItem[];
  loading: boolean;
  repoOwner: string;
  repoName: string;
  pullNumber: number;
  hasNextPage?: boolean;
  loadingMore?: boolean;
  canDismissReview?: boolean;
  dismissingReviewId?: string | null;
  reviewDismissResult?: ReviewDismissResult | null;
  resolvingReviewThreadId?: string | null;
  replyingReviewThreadId?: string | null;
  reviewThreadReplyResult?: ReviewThreadReplyResult | null;
}>();

const emit = defineEmits<{
  (e: 'switch-issue', owner: string, repo: string, issueNumber: number): void;
  (e: 'switch-pull-request', owner: string, repo: string, pullNumber: number): void;
  (e: 'comment-created', item: PRTimelineItem): void;
  (e: 'load-more'): void;
  (e: 'toggle-review-thread', threadId: string, resolved: boolean): void;
  (e: 'reply-to-review-thread', payload: { threadId: string; body: string }): void;
  (e: 'dismiss-review', payload: { reviewId: string; message: string }): void;
}>();

const { t } = useI18n();
const { processedTimeline } = usePRTimelineEvents(() => props.timeline);

const handleSwitchIssue = (owner: string, repo: string, issueNumber: number) => {
  emit('switch-issue', owner, repo, issueNumber);
};

const handleSwitchPullRequest = (owner: string, repo: string, pullNumber: number) => {
  emit('switch-pull-request', owner, repo, pullNumber);
};
</script>

<style scoped lang="scss">
.pr-timeline-events__composer {
  padding-top: 1rem;
}
</style>
