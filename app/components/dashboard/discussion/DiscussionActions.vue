<!-- Discussion Actions — Sidebar card with discussion metadata, labels and action controls. -->
<template>
  <div>
    <div class="sidebar-card mb-4">
      <div class="sidebar-card__content">
        <div v-if="lockError" class="sidebar-alert sidebar-alert--error mb-3">
          <AlertCircleIcon :size="14" />
          <span>{{ lockError }}</span>
        </div>
        <button
          class="sidebar-action-btn"
          type="button"
          :disabled="lockPending"
          @click="handleLockButton"
        >
          <Loader2Icon v-if="lockPending" class="spin-animation" :size="14" />
          <LockIcon v-else-if="!discussion.locked" :size="14" />
          <UnlockIcon v-else :size="14" />
          <span>{{ lockButtonLabel }}</span>
        </button>
      </div>
    </div>

    <div class="sidebar-card mb-4">
      <div class="sidebar-card__header">
        <div class="sidebar-card__header-left">
          <MessageSquareIcon :size="14" class="sidebar-card__icon" />
          <span class="sidebar-card__title">{{ t('discussionDetail.metadata') }}</span>
        </div>
      </div>
      <div class="sidebar-card__content">
        <div class="info-list">
          <div class="info-item">
            <span class="info-item__label">{{ t('discussionDetail.author') }}</span>
            <span v-if="discussion.author" class="info-item__value">
              <span class="info-item__avatar">
                <img
                  :src="discussion.author.avatarUrl || ''"
                  :alt="discussion.author.login || t('discussionDetail.authorFallback')"
                />
              </span>
              {{ discussion.author.login }}
            </span>
            <span v-else class="info-item__value info-item__value--muted">
              {{ t('discussionDetail.authorFallback') }}
            </span>
          </div>
          <div class="info-item">
            <span class="info-item__label">{{ t('discussionDetail.category') }}</span>
            <span v-if="discussion.category" class="info-item__value">
              <TagIcon :size="12" />
              {{ discussion.category.name }}
            </span>
            <span v-else class="info-item__value info-item__value--muted">
              {{ t('discussionDetail.noCategory') }}
            </span>
          </div>
          <div class="info-item">
            <span class="info-item__label">{{ t('discussionDetail.state') }}</span>
            <span class="info-item__value">
              <CheckCircle2Icon
                v-if="discussion.isAnswered"
                :size="12"
                class="state-icon state-icon--answered"
              />
              <CircleIcon v-else :size="12" class="state-icon state-icon--unanswered" />
              {{
                discussion.isAnswered
                  ? t('discussionDetail.answered')
                  : t('discussionDetail.unanswered')
              }}
            </span>
          </div>
          <div class="info-item">
            <span class="info-item__label">{{ t('discussionDetail.created') }}</span>
            <span class="info-item__value">{{ createdAtLabel }}</span>
          </div>
          <div class="info-item">
            <span class="info-item__label">{{ t('discussionDetail.updated') }}</span>
            <span class="info-item__value">{{ updatedAtLabel }}</span>
          </div>
          <div class="info-item">
            <span class="info-item__label">{{ t('discussionDetail.comments') }}</span>
            <span class="info-item__value">
              <MessageSquareIcon :size="12" />
              {{ discussion.comments.totalCount }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="discussion.url" class="sidebar-card">
      <div class="sidebar-card__content">
        <a
          :href="discussion.url"
          target="_blank"
          rel="noopener noreferrer"
          data-nekogit-external
          class="sidebar-link"
        >
          <ExternalLinkIcon :size="14" />
          <span>{{ t('discussionDetail.viewOnGithub') }}</span>
        </a>
      </div>
    </div>

    <div class="modal" :class="{ 'is-active': showLockModal }">
      <div class="modal-background" @click="closeLockModal"></div>
      <div class="modal-card">
        <header class="modal-card-head">
          <p class="modal-card-title">{{ t('discussionDetail.lockReasonTitle') }}</p>
          <button
            class="delete"
            type="button"
            :aria-label="t('discussionDetail.cancel')"
            :disabled="lockPending"
            @click="closeLockModal"
          ></button>
        </header>
        <section class="modal-card-body">
          <p class="is-size-7 has-text-grey mb-4">
            {{ t('discussionDetail.selectLockReason') }}
          </p>
          <div
            v-for="reason in lockReasons"
            :key="reason.value"
            class="lock-reason-item is-flex is-align-items-center p-3 rounded cursor-pointer"
            :class="{ 'is-selected': selectedReason === reason.value }"
            @click="selectedReason = reason.value"
          >
            <div class="mr-4">
              <input
                :id="`discussion-lock-reason-${reason.value}`"
                v-model="selectedReason"
                type="radio"
                name="discussion-lock-reason"
                :value="reason.value"
                style="width: 16px; height: 16px"
                @click.stop
              />
            </div>
            <div class="is-flex-grow-1">
              <div class="is-size-6 has-text-weight-medium">{{ reason.label }}</div>
              <div class="is-size-7 has-text-grey">{{ reason.description }}</div>
            </div>
          </div>
        </section>
        <footer class="modal-card-foot">
          <button
            class="button is-light"
            type="button"
            :disabled="lockPending"
            @click="closeLockModal"
          >
            {{ t('discussionDetail.cancel') }}
          </button>
          <button
            class="button is-primary ml-4"
            type="button"
            :disabled="!selectedReason || lockPending"
            :class="{ 'is-loading': lockPending }"
            @click="confirmLock"
          >
            {{ lockPending ? t('discussionDetail.locking') : t('discussionDetail.lock') }}
          </button>
        </footer>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  CircleIcon,
  ExternalLinkIcon,
  LockIcon,
  Loader2Icon,
  MessageSquareIcon,
  TagIcon,
  UnlockIcon,
} from 'lucide-vue-next';
import { computed, shallowRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { formatDurationFromNow } from '#imports';
import type { DiscussionDetailPayload } from '#shared/types/discussions';
import type { DiscussionLockReason } from '#shared/utils/discussion-actions';

const props = defineProps<{
  discussion: DiscussionDetailPayload;
  lockPending?: boolean;
  lockError?: string;
  submitLock: (locked: boolean, reason?: DiscussionLockReason) => Promise<void>;
}>();

const showLockModal = shallowRef(false);
const selectedReason = shallowRef<DiscussionLockReason | ''>('');

const lockButtonLabel = computed(() => {
  if (props.lockPending) {
    return props.discussion.locked
      ? t('discussionDetail.unlocking')
      : t('discussionDetail.locking');
  }

  return props.discussion.locked ? t('discussionDetail.unlock') : t('discussionDetail.lock');
});

const lockReasons = computed(() => [
  {
    value: 'off-topic' as const,
    label: t('discussionDetail.lockReasonOffTopic'),
    description: t('discussionDetail.lockReasonOffTopicDesc'),
  },
  {
    value: 'too-heated' as const,
    label: t('discussionDetail.lockReasonTooHeated'),
    description: t('discussionDetail.lockReasonTooHeatedDesc'),
  },
  {
    value: 'resolved' as const,
    label: t('discussionDetail.lockReasonResolved'),
    description: t('discussionDetail.lockReasonResolvedDesc'),
  },
  {
    value: 'spam' as const,
    label: t('discussionDetail.lockReasonSpam'),
    description: t('discussionDetail.lockReasonSpamDesc'),
  },
]);

function openLockModal() {
  selectedReason.value = '';
  showLockModal.value = true;
}

watch(
  () => props.discussion.id,
  () => {
    showLockModal.value = false;
    selectedReason.value = '';
  }
);

function closeLockModal() {
  if (props.lockPending) return;
  showLockModal.value = false;
}

async function handleLockButton() {
  if (props.lockPending) return;

  if (props.discussion.locked) {
    try {
      await props.submitLock(false);
    } catch {
      // The parent surfaces the failure through the lockError prop.
    }
    return;
  }

  openLockModal();
}

async function confirmLock() {
  if (!selectedReason.value || props.lockPending) return;

  try {
    await props.submitLock(true, selectedReason.value);
    showLockModal.value = false;
    selectedReason.value = '';
  } catch {
    // The parent surfaces the failure through the lockError prop.
  }
}

const { locale, t } = useI18n();
const relativeTimeNow = useRelativeTimeNow();
const localeCode = computed(() => locale.value);

const createdAtLabel = computed(() =>
  props.discussion.createdAt
    ? formatDurationFromNow(props.discussion.createdAt, localeCode.value, relativeTimeNow.value)
    : t('discussionDetail.notAvailable')
);

const updatedAtLabel = computed(() =>
  props.discussion.updatedAt
    ? formatDurationFromNow(props.discussion.updatedAt, localeCode.value, relativeTimeNow.value)
    : t('discussionDetail.notAvailable')
);
</script>

<style scoped lang="scss">
@use '~/assets/scss/_variables' as *;

.sidebar-card {
  background: var(--nekogit-surface-muted);
  border: 1px solid var(--nekogit-border);
  border-radius: 8px;
  overflow: hidden;
}

.sidebar-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--nekogit-border);
  background: var(--nekogit-surface);
}

.sidebar-card__header-left {
  display: flex;
  align-items: center;
  gap: 6px;
}

.sidebar-card__icon {
  color: $brand-primary;
}

.sidebar-card__title {
  font-size: 13px;
  font-weight: 600;
  color: var(--bulma-text-strong, var(--nekogit-text-strong));
  letter-spacing: -0.01em;
}

.sidebar-card__content {
  padding: 12px 16px;
}

.info-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.info-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.info-item__label {
  font-size: 12px;
  color: var(--nekogit-text-muted);
  flex-shrink: 0;
}

.info-item__value {
  font-size: 12px;
  color: var(--bulma-text-strong, var(--nekogit-text-strong));
  display: flex;
  align-items: center;
  gap: 6px;
  text-align: right;
}

.info-item__value--muted {
  color: var(--nekogit-text-subtle);
}

.info-item__avatar {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.state-icon--answered {
  color: var(--nekogit-success);
}

.state-icon--unanswered {
  color: var(--nekogit-text-muted);
}

.sidebar-link {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 500;
  color: var(--nekogit-text-muted);
  text-decoration: none;
  transition: color 0.12s ease;

  &:hover {
    color: var(--nekogit-accent);
  }
}

.sidebar-alert {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 8px;
  font-size: 12px;
}

.sidebar-alert--error {
  background: var(--nekogit-danger-soft);
  color: var(--nekogit-danger);
}

.sidebar-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  background: var(--nekogit-surface);
  border: 1px solid var(--nekogit-border);
  border-radius: 8px;
  font-size: 12px;
  font-weight: 500;
  color: var(--nekogit-text-muted);
  cursor: pointer;
  transition: all 0.12s ease;

  &:hover:not(:disabled) {
    background: var(--nekogit-surface-hover);
    border-color: var(--nekogit-border-strong);
    color: var(--bulma-text-strong, var(--nekogit-text-strong));
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.lock-reason-item {
  border: 1px solid transparent;
  border-radius: 0.5rem;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease;

  &:hover {
    background: var(--nekogit-surface-hover);
    border-color: var(--nekogit-border);
  }

  &.is-selected {
    background: var(--nekogit-surface-active);
    border-color: var(--nekogit-border-strong);
  }
}

.spin-animation {
  animation: discussion-action-spin 1s linear infinite;
}

@keyframes discussion-action-spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}
</style>
