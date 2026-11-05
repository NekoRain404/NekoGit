<!-- PRHeader — PR page header with title, state icon, number and metadata. -->
<template>
  <div class="mb-6">
    <div class="is-flex is-align-items-center mb-4">
      <component :size="24" :is="stateIcon" :style="stateColor" />
      <h1 class="title is-3 ml-4">{{ pullRequest?.title }}</h1>
    </div>

    <div class="is-flex is-align-items-center my-4 is-flex-wrap-wrap">
      <span class="tag mr-2" :style="typeStyle">Pull Request</span>
      <span class="tag is-info is-light ml-2">#{{ pullRequest?.number }}</span>
      <span
        class="ml-2 tag"
        :class="
          displayState === 'open'
            ? 'is-success is-light'
            : displayState === 'merged'
              ? 'is-primary is-light'
              : 'is-danger is-light'
        "
      >
        {{ displayState }}
      </span>
      <span class="ml-4 has-text-grey has-text-weight-medium">
        {{ updatedAtLabel }}
      </span>
    </div>

    <div class="mb-4">
      <span class="subtitle mb-0 is-6 has-text-weight-medium">{{ repoOwner }}/{{ repoName }}</span>
      <span v-if="pullRequest?.head?.ref && pullRequest?.base?.ref" class="ml-4">
        <span class="tag is-link is-light has-text-weight-medium">
          {{ pullRequest?.head?.ref }}
        </span>
        <span class="mx-2 has-text-grey">
          <ArrowRightIcon :size="14" />
        </span>
        <span class="tag is-link is-light has-text-weight-medium">
          {{ pullRequest?.base?.ref }}
        </span>
      </span>
    </div>

    <hr class="mr-4" />

    <div>
      <div class="is-flex is-align-items-center mb-4">
        <RoundImg
          class="mr-4"
          width="32"
          height="32"
          :src="pullRequest?.user?.avatar_url ?? ''"
          :alt="pullRequest?.user?.login"
        />
        <div class="is-flex is-flex-direction-column is-justify-content-center">
          <a
            :href="`https://github.com/${pullRequest?.user?.login}`"
            target="_blank"
            rel="noopener"
            class="is-size-6 has-text-weight-medium has-text-link"
          >
            {{ pullRequest?.user?.login }}
          </a>
          <span class="is-size-7 has-text-grey">
            {{ createdAtLabel }}
          </span>
        </div>
      </div>
      <div class="content">
        <MarkdownRenderer
          v-if="pullRequest?.body"
          :value="pullRequest.body"
          :repo-owner="repoOwner"
          :repo-name="repoName"
        />
        <p v-else>{{ t('prReview.noDescription') }}</p>
      </div>

      <div class="pr-header__actions mb-4">
        <button
          v-if="pullRequest?.number"
          class="button is-small is-light mr-2"
          type="button"
          @click="emit('edit-pr')"
        >
          <PencilIcon :size="14" class="mr-1" />
          {{ t('prReview.editPr') }}
        </button>
        <template v-if="displayState === 'open'">
          <button
            class="button is-small is-success is-light mr-2"
            type="button"
            :disabled="!commitId"
            @click="emit('approve')"
          >
            <CheckIcon :size="14" class="mr-1" />
            {{ t('prReview.eventApprove') }}
          </button>
          <button
            class="button is-small is-warning is-light mr-2"
            type="button"
            :disabled="!commitId"
            @click="emit('request-changes')"
          >
            <XCircleIcon :size="14" class="mr-1" />
            {{ t('prReview.eventRequestChanges') }}
          </button>
          <button
            v-if="pullRequest?.draft"
            class="button is-small is-light mr-2"
            type="button"
            @click="emit('mark-ready')"
          >
            <GitPullRequestIcon :size="14" class="mr-1" />
            {{ t('prReview.markReadyForReview') }}
          </button>
          <button
            v-else
            class="button is-small is-light mr-2"
            type="button"
            @click="emit('convert-to-draft')"
          >
            <GitPullRequestDraftIcon :size="14" class="mr-1" />
            {{ t('prReview.convertToDraft') }}
          </button>
          <div v-if="canMerge && mergeable !== false" class="pr-header__merge-controls mr-2">
            <div class="select is-small">
              <select v-model="mergeMethod" :aria-label="t('prReview.mergeMethod')">
                <option value="merge">{{ t('prReview.mergeMethodMerge') }}</option>
                <option value="squash">{{ t('prReview.mergeMethodSquash') }}</option>
                <option value="rebase">{{ t('prReview.mergeMethodRebase') }}</option>
              </select>
            </div>
            <button
              class="button is-small is-info is-light"
              type="button"
              @click="emit('merge', mergeMethod)"
            >
              <GitMergeIcon :size="14" class="mr-1" />
              {{ t('prReview.mergePr') }}
            </button>
          </div>
          <button
            class="button is-small is-danger is-light"
            type="button"
            @click="emit('close-pr')"
          >
            <GitPullRequestClosedIcon :size="14" class="mr-1" />
            {{ t('prReview.closePr') }}
          </button>
        </template>
        <button
          v-else-if="displayState === 'closed'"
          class="button is-small is-success is-light"
          type="button"
          @click="emit('reopen-pr')"
        >
          <GitPullRequestIcon :size="14" class="mr-1" />
          {{ t('prReview.reopenPr') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  ArrowRightIcon,
  CheckIcon,
  GitMergeIcon,
  GitPullRequestClosedIcon,
  GitPullRequestDraftIcon,
  GitPullRequestIcon,
  PencilIcon,
  XCircleIcon,
} from 'lucide-vue-next';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { formatDurationFromNow } from '#imports';
import MarkdownRenderer from '~/components/ui/MarkdownRenderer.vue';
import RoundImg from '~/components/ui/RoundImg.vue';

const { locale, t } = useI18n();
const localeCode = computed(() => locale.value);
const relativeTimeNow = useRelativeTimeNow();

/** Pull Request Header Pull Request. */
interface PullRequestHeaderPullRequest {
  title?: string;
  number?: number | string;
  state?: string;
  merged_at?: string | null;
  updated_at?: string;
  head?: { ref?: string };
  base?: { ref?: string };
  user?: {
    avatar_url?: string;
    login?: string;
  };
  created_at?: string;
  body?: string;
  draft?: boolean;
}

const props = defineProps<{
  pullRequest?: PullRequestHeaderPullRequest | null;
  repoOwner: string;
  repoName: string;
  commitId: string;
  mergeable?: boolean | null;
  canMerge?: boolean;
}>();

const emit = defineEmits<{
  (e: 'approve'): void;
  (e: 'request-changes'): void;
  (e: 'merge', method: PullMergeMethod): void;
  (e: 'close-pr'): void;
  (e: 'reopen-pr'): void;
  (e: 'edit-pr'): void;
  (e: 'convert-to-draft'): void;
  (e: 'mark-ready'): void;
}>();

type PullMergeMethod = 'merge' | 'squash' | 'rebase';

const mergeMethod = ref<PullMergeMethod>('merge');

const displayState = computed(() => {
  if (props.pullRequest?.merged_at) return 'merged';
  return props.pullRequest?.state || 'closed';
});

const updatedAtLabel = computed(() => {
  return props.pullRequest?.updated_at
    ? formatDurationFromNow(props.pullRequest.updated_at, localeCode.value, relativeTimeNow.value)
    : '-';
});

const createdAtLabel = computed(() => {
  return props.pullRequest?.created_at
    ? formatDurationFromNow(props.pullRequest.created_at, localeCode.value, relativeTimeNow.value)
    : '-';
});

const stateIcon = computed(() => {
  if (displayState.value === 'open') {
    return GitPullRequestIcon;
  } else if (displayState.value === 'merged') {
    return GitMergeIcon;
  } else {
    return GitPullRequestClosedIcon;
  }
});

const stateColor = computed(() => {
  if (displayState.value === 'open') {
    return { color: 'var(--nekogit-success)' };
  } else if (displayState.value === 'merged') {
    return { color: 'var(--nekogit-info)' };
  } else {
    return { color: 'var(--nekogit-text-strong)' };
  }
});

const typeStyle = {
  backgroundColor: 'var(--nekogit-surface-muted)',
  color: 'var(--nekogit-text-strong)',
};
</script>

<style scoped lang="scss">
.pr-header__actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.pr-header__merge-controls {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
}
</style>
