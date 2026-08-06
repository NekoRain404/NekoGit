<!-- Notification Item — Card rendering a single notification with unread state and linked subject. -->
<template>
  <div
    class="card dashboard-list-card dashboard-list-card--activity dashboard-list-card--detailed notification-card"
    :class="{ 'is-unread': currentNotification.unread }"
  >
    <div class="card-content p-3">
      <div class="dashboard-list-card__main-row notification-card__main-row">
        <div class="dashboard-list-card__icon">
          <figure class="image is-32x32">
            <NuxtImg
              :src="notificationOwner.avatarUrl"
              :alt="notificationOwner.login"
              width="32"
              height="32"
              loading="lazy"
              class="is-rounded"
            />
            <span
              v-if="subjectVisual.icon"
              class="notification-type-badge"
              :class="{
                'notification-type-badge--pending': isSubjectStatePending,
                'notification-type-badge--error': isSubjectStateError,
                [subjectVisualClass]: Boolean(subjectVisualClass),
              }"
              :title="subjectStateTitle"
              :aria-label="subjectStateTitle"
            >
              <Transition name="notification-state-icon" mode="out-in">
                <component :is="subjectVisual.icon" :key="subjectVisual.label" :size="13" />
              </Transition>
            </span>
          </figure>
        </div>
        <div class="dashboard-list-card__content">
          <div class="is-flex is-align-items-flex-start">
            <div class="dashboard-list-card__text-stack">
              <p class="title is-6 mb-1 dashboard-list-card__subject">
                {{ notificationSubject.title }}
              </p>

              <p class="subtitle is-7 has-text-grey mb-0 dashboard-list-card__meta">
                <span v-if="notificationSubject.number" class="notification-card__number">
                  #{{ notificationSubject.number }}
                </span>
                <span class="notification-card__meta-separator"></span>
                {{ notificationRepository.fullName }}
                <span class="dashboard-list-card__separator">&middot;</span>
                {{
                  formatDurationFromNow(currentNotification.updated_at, localeCode, relativeTimeNow)
                }}
              </p>
            </div>
            <div class="notification-card__actions ml-3">
              <div class="notification-card__reason-slot">
                <component :is="reasonIcon" :size="22" class="notification-card__reason-icon" />
              </div>
              <div class="notification-card__mark-read-slot">
                <button
                  v-if="currentNotification.unread"
                  class="mark-read-btn"
                  type="button"
                  @click.stop="handleMarkAsRead"
                  :disabled="markingAsRead"
                >
                  <CheckIcon v-if="!markingAsRead" :size="16" />
                  <LoadingIcon v-else :spinning="true" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  ActivityIcon,
  AtSignIcon,
  BellIcon,
  BookmarkIcon,
  CheckCircleIcon,
  CheckIcon,
  EyeIcon,
  GitCommitIcon,
  MailIcon,
  MessageSquareIcon,
  PenLineIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  UserPlusIcon,
  Users2Icon,
  UsersIcon,
} from 'lucide-vue-next';
import { ref, computed } from 'vue';

import { formatDurationFromNow } from '#imports';
import type { DashboardNotification } from '#shared/types/notifications';
import LoadingIcon from '~/components/ui/LoadingIcon.vue';
import getDashboardSubjectStateVisual from '~/utils/getDashboardSubjectStateVisual';

const props = defineProps<{
  notification: DashboardNotification;
  markRead?: (notification: DashboardNotification) => Promise<void> | void;
}>();

const { locale } = useI18n();
const localeCode = computed(() => locale.value);
const relativeTimeNow = useRelativeTimeNow();
const markingAsRead = ref(false);
const isLocallyRead = ref(false);

const currentNotification = computed(() => ({
  ...props.notification,
  unread: isLocallyRead.value ? false : props.notification.unread,
}));

const isSubjectStatePending = computed(() => {
  return currentNotification.value.subject?.stateStatus === 'pending';
});

const isSubjectStateError = computed(() => {
  return currentNotification.value.subject?.stateStatus === 'error';
});

const isPullRequestSubject = computed(() => {
  return currentNotification.value.subject?.type === 'PullRequest';
});

const subjectVisual = computed(() => {
  return getDashboardSubjectStateVisual({
    isPullRequest: isPullRequestSubject.value,
    state: currentNotification.value.subject?.state,
    subjectType: currentNotification.value.subject?.type,
  });
});

const subjectVisualClass = computed(() => {
  return subjectVisual.value.state ? `notification-type-badge--${subjectVisual.value.state}` : '';
});

const notificationRepository = computed(() => {
  const repository = currentNotification.value.repository;
  return {
    fullName: repository?.full_name ?? '',
    owner: repository?.owner,
  };
});

const notificationOwner = computed(() => {
  const owner = notificationRepository.value.owner;
  const login = owner?.login ?? '';
  return {
    avatarUrl: owner?.avatar_url ?? '',
    login,
  };
});

const notificationSubject = computed(() => {
  const subject = currentNotification.value.subject;
  return {
    title: subject?.title ?? '',
    number: subject?.number,
  };
});

const subjectStateTitle = computed(() => {
  if (isSubjectStatePending.value) {
    return `${subjectVisual.value.label}: status loading`;
  }

  if (isSubjectStateError.value) {
    return `${subjectVisual.value.label}: status unavailable`;
  }

  return subjectVisual.value.label;
});

const handleMarkAsRead = async () => {
  if (markingAsRead.value || !currentNotification.value.unread) return;

  markingAsRead.value = true;
  try {
    await props.markRead?.(currentNotification.value);
    isLocallyRead.value = true;
  } catch (error) {
    console.error('Failed to mark notification as read:', error);
  } finally {
    markingAsRead.value = false;
  }
};

const reasonIconMap: Record<string, typeof BellIcon> = {
  approval_requested: CheckCircleIcon, // Deployment approval requested
  assign: UserPlusIcon, // You were assigned to the issue
  author: PenLineIcon, // You created the thread
  ci_activity: ActivityIcon, // CI workflow activity completed
  comment: MessageSquareIcon, // You commented on the thread
  invitation: MailIcon, // Repository invitation accepted
  manual: BookmarkIcon, // Manually subscribed to the thread
  member_feature_requested: UsersIcon, // Organization members requested a feature
  mention: AtSignIcon, // You were @mentioned
  review_requested: EyeIcon, // Pull request review requested
  security_advisory_credit: ShieldCheckIcon, // Credited for security advisory contribution
  security_alert: ShieldAlertIcon, // Security vulnerability alert
  state_change: GitCommitIcon, // Thread state changed (close / merge / etc.)
  subscribed: BellIcon, // Watching the repository
  team_mention: Users2Icon, // Your team was mentioned
};

const reasonIcon = computed(() => {
  return reasonIconMap[currentNotification.value.reason ?? ''] ?? BellIcon;
});
</script>

<style scoped lang="scss" src="~/assets/scss/card.scss" />
<style scoped lang="scss">
.card.is-unread {
  background-color: var(--nekogit-unread-bg);
}

.card.is-unread::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 4px;
  background-color: var(--nekogit-link);
  pointer-events: none;
  z-index: 1;
}

.notification-type-badge {
  position: absolute;
  right: -3px;
  bottom: -3px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border: 2px solid var(--nekogit-surface);
  border-radius: 999px;
  background-color: var(--nekogit-surface);
  box-shadow: 0 1px 4px color-mix(in srgb, var(--nekogit-text-strong) 18%, transparent);
  line-height: 1;
  transition:
    color 0.25s ease,
    opacity 0.3s ease,
    border-color 0.3s ease;
}

.notification-type-badge--pending {
  animation: notification-state-pulse 2s ease-in-out infinite;
  opacity: 0.45;
}

.notification-type-badge--error {
  border-color: var(--nekogit-border-strong);
  opacity: 0.45;
}

.notification-type-badge--open {
  color: var(--nekogit-success);
}

.notification-type-badge--closed {
  color: var(--nekogit-text-muted);
}

.notification-type-badge--merged {
  color: var(--nekogit-info);
}

.notification-type-badge--discussion {
  color: var(--nekogit-info);
}

.notification-type-badge--release {
  color: var(--nekogit-warning);
}

.notification-state-icon-enter-active,
.notification-state-icon-leave-active {
  transition: opacity 0.2s ease;
}

.notification-state-icon-enter-from,
.notification-state-icon-leave-to {
  opacity: 0;
}

.mark-read-btn {
  opacity: 0;
  visibility: hidden;
  color: var(--nekogit-text);
  cursor: pointer;
  padding: 4px;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  transition: all 0.3s ease;
}

.notification-card__actions {
  display: grid;
  grid-template-columns: 24px 24px;
  gap: 0.35rem;
  flex: 0 0 auto;
}

.notification-card__reason-slot,
.notification-card__mark-read-slot {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
}

.notification-card__reason-icon {
  color: var(--nekogit-text-muted);
  flex: 0 0 auto;
}

.notification-card:hover .mark-read-btn {
  opacity: 1;
  visibility: visible;
}

.notification-card__number {
  color: var(--nekogit-info);
  font-weight: 500;
}

.notification-card__meta-separator {
  display: inline-block;
  width: 0.5rem;
}

.mark-read-btn:hover {
  background-color: var(--nekogit-surface-hover);
  color: var(--bulma-text-strong, var(--nekogit-text-strong));
}

.mark-read-btn:disabled {
  opacity: 0.8;
  cursor: not-allowed;
}

.is-spinning {
  animation: spin 1.4s linear infinite;
}

@keyframes notification-state-pulse {
  0%,
  100% {
    opacity: 0.35;
  }

  50% {
    opacity: 0.65;
  }
}
</style>
