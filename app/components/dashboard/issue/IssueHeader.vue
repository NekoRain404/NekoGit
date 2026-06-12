<!-- Issue Header — NekoGit dashboard component. -->
<template>
  <div class="mb-6">
    <div class="is-flex is-align-items-center mb-4">
      <component :size="24" :is="stateIcon" :style="stateColor" />
      <h1 class="title is-3 ml-4">{{ issue?.title }}</h1>
    </div>

    <div class="is-flex is-align-items-center my-4 is-flex-wrap-wrap">
      <span class="tag mr-2" :style="typeStyle">
        {{ issue?.type?.name || t('issueDetail.issueTypeFallback') }}
      </span>
      <span class="tag is-info is-light ml-2">#{{ issue?.number }}</span>
      <span
        class="ml-2 tag"
        :class="issue?.state === 'open' ? 'is-success is-light' : 'is-danger is-light'"
      >
        {{ issue?.state }}
      </span>
      <span class="ml-4 has-text-grey has-text-weight-medium">
        {{ formatDurationFromNow(issue?.updated_at, localeCode, relativeTimeNow) }}
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
          :src="issueAuthor.avatarUrl"
          :alt="issueAuthor.login"
        />
        <div class="is-flex is-flex-direction-column is-justify-content-center">
          <a
            :href="`https://github.com/${issue?.user?.login}`"
            target="_blank"
            rel="noopener"
            class="is-size-6 has-text-weight-medium has-text-link"
          >
            {{ issue?.user?.login }}
          </a>
          <span class="is-size-7 has-text-grey">
            {{ formatDurationFromNow(issue?.created_at, localeCode, relativeTimeNow) }}
          </span>
        </div>
      </div>
      <div class="content">
        <MarkdownRenderer
          v-if="issue?.body"
          :value="issue.body"
          :repo-owner="repoOwner"
          :repo-name="repoName"
        />
        <p v-else>{{ t('issueDetail.noDescription') }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { CircleDotIcon, CircleMinusIcon } from 'lucide-vue-next';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { formatDurationFromNow } from '#imports';
import MarkdownRenderer from '~/components/ui/MarkdownRenderer.vue';
import RoundImg from '~/components/ui/RoundImg.vue';

const { locale, t } = useI18n();
const localeCode = computed(() => locale.value);
const relativeTimeNow = useRelativeTimeNow();

/** Issue Header Issue. */
interface IssueHeaderIssue {
  title?: string;
  type?: { name?: string };
  number?: number | string;
  state?: string;
  updated_at?: string;
  user?: {
    avatar_url?: string;
    login?: string;
  };
  created_at?: string;
  body?: string;
}

const props = defineProps<{
  issue?: IssueHeaderIssue | null;
  repoOwner: string;
  repoName: string;
}>();

const issueAuthor = computed(() => {
  const login = props.issue?.user?.login ?? '';
  return {
    avatarUrl: props.issue?.user?.avatar_url ?? '',
    login,
  };
});

const stateIcon = computed(() => {
  return props.issue?.state === 'open' ? CircleDotIcon : CircleMinusIcon;
});

const stateColor = computed(() => {
  return {
    color: props.issue?.state === 'open' ? 'var(--nekogit-success)' : 'var(--nekogit-text-strong)',
  };
});

const typeStyle = {
  backgroundColor: 'var(--nekogit-surface-muted)',
  color: 'var(--nekogit-text-strong)',
};
</script>
