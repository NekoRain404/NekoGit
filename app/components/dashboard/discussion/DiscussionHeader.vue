<!-- Discussion Header — Discussion page header with title, state icon, type and metadata. -->
<template>
  <div class="mb-6">
    <div class="is-flex is-align-items-center mb-4">
      <MessageSquareIcon :size="24" :style="stateColor" />
      <h1 class="title is-3 ml-4">
        {{ discussion.title || t('discussionDetail.titleFallback') }}
      </h1>
    </div>

    <div class="is-flex is-align-items-center my-4 is-flex-wrap-wrap">
      <span class="tag mr-2" :style="typeStyle">{{ t('discussionDetail.type') }}</span>
      <span class="tag is-info is-light ml-2">#{{ discussion.number }}</span>
      <span class="ml-2 tag" :class="discussion.isAnswered ? 'is-success is-light' : 'is-light'">
        {{ stateLabel }}
      </span>
      <span v-if="discussion.locked" class="ml-2 tag is-warning is-light">
        <LockIcon :size="13" class="mr-1" />
        {{ t('discussionDetail.locked') }}
      </span>
      <span v-if="discussion.category" class="ml-2 tag is-light" :style="categoryStyle">
        {{ discussion.category.name }}
      </span>
      <button
        class="button is-small ml-2"
        :class="discussion.viewerHasUpvoted ? 'is-primary is-light' : 'is-light'"
        type="button"
        :disabled="upvotePending"
        :aria-label="upvoteLabel"
        @click="emit('toggle-upvote')"
      >
        <ThumbsUpIcon :size="14" />
        <span>{{ discussion.upvoteCount }}</span>
        <span class="ml-1">{{ upvoteLabel }}</span>
      </button>
      <span v-if="upvoteError" class="ml-2 is-size-7 has-text-danger">{{ upvoteError }}</span>
      <span class="ml-4 has-text-grey has-text-weight-medium">
        {{
          formatDurationFromNow(
            discussion.updatedAt || discussion.createdAt || '',
            localeCode,
            relativeTimeNow
          )
        }}
      </span>
    </div>

    <div class="mb-4">
      <span class="subtitle is-6 has-text-weight-medium"> {{ repoOwner }}/{{ repoName }} </span>
    </div>

    <hr class="mr-4" />

    <div>
      <div class="is-flex is-align-items-center mb-4">
        <RoundImg
          class="mr-4"
          width="32"
          height="32"
          :src="discussion.author?.avatarUrl || ''"
          :alt="discussion.author?.login || t('discussionDetail.authorFallback')"
        />
        <div class="is-flex is-flex-direction-column is-justify-content-center">
          <a
            v-if="discussion.author?.url"
            :href="discussion.author.url"
            target="_blank"
            rel="noopener"
            class="is-size-6 has-text-weight-medium has-text-link"
          >
            {{ discussion.author.login }}
          </a>
          <span v-else class="is-size-6 has-text-weight-medium">
            {{ discussion.author?.login || t('discussionDetail.authorFallback') }}
          </span>
          <span class="is-size-7 has-text-grey">
            {{ formatDurationFromNow(discussion.createdAt || '', localeCode, relativeTimeNow) }}
          </span>
        </div>
      </div>
      <div class="content">
        <MarkdownRenderer
          v-if="discussion.body"
          :value="discussion.body"
          :repo-owner="repoOwner"
          :repo-name="repoName"
        />
        <p v-else>{{ t('discussionDetail.noDescription') }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { LockIcon, MessageSquareIcon, ThumbsUpIcon } from 'lucide-vue-next';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import type { DiscussionDetailPayload } from '#shared/types/discussions';
import MarkdownRenderer from '~/components/ui/MarkdownRenderer.vue';
import RoundImg from '~/components/ui/RoundImg.vue';

const { locale, t } = useI18n();
const localeCode = computed(() => locale.value);
const relativeTimeNow = useRelativeTimeNow();

const props = defineProps<{
  discussion: DiscussionDetailPayload;
  repoOwner: string;
  repoName: string;
  upvotePending?: boolean;
  upvoteError?: string;
}>();

const emit = defineEmits<{
  (e: 'toggle-upvote'): void;
}>();

const upvoteLabel = computed(() =>
  props.discussion.viewerHasUpvoted
    ? t('discussionDetail.removeUpvote')
    : t('discussionDetail.upvote')
);

const stateLabel = computed(() =>
  props.discussion.isAnswered ? t('discussionDetail.answered') : t('discussionDetail.unanswered')
);

const stateColor = computed(() => ({
  color: props.discussion.isAnswered ? 'var(--nekogit-success)' : 'var(--nekogit-text-strong)',
}));

const typeStyle = {
  backgroundColor: 'var(--nekogit-surface-muted)',
  color: 'var(--nekogit-text-strong)',
};

const categoryStyle = {
  backgroundColor: 'var(--nekogit-surface-muted)',
  color: 'var(--nekogit-text-strong)',
};
</script>
