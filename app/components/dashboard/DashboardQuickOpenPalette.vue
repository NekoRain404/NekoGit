<!-- Dashboard Quick Open Palette — NekoGit dashboard component. -->
<template>
  <Teleport to="body">
    <Transition name="quick-open">
      <div
        v-if="isOpen"
        class="quick-open-overlay"
        @click.self="close"
        @keydown.escape.prevent="close"
      >
        <form
          class="quick-open-panel"
          role="dialog"
          aria-modal="true"
          :aria-label="t('dashboard.quickOpen.title')"
          @submit.prevent="openTarget"
        >
          <div class="quick-open-header">
            <div>
              <p class="quick-open-kicker">{{ t('dashboard.quickOpen.kicker') }}</p>
              <h2 class="quick-open-title">{{ t('dashboard.quickOpen.title') }}</h2>
            </div>
            <button
              class="button is-ghost is-small quick-open-icon-button"
              type="button"
              :aria-label="t('dashboard.quickOpen.close')"
              :title="t('dashboard.quickOpen.close')"
              @click="close"
            >
              <XIcon v-once :size="18" />
            </button>
          </div>

          <div class="quick-open-search">
            <SearchIcon v-once :size="18" class="quick-open-search__icon" />
            <input
              ref="inputRef"
              v-model="inputValue"
              class="input quick-open-input"
              type="text"
              autocomplete="off"
              spellcheck="false"
              :placeholder="t('dashboard.quickOpen.placeholder')"
              :aria-label="t('dashboard.quickOpen.inputLabel')"
            />
            <button
              v-if="inputValue"
              class="button is-ghost is-small quick-open-input-action"
              type="button"
              :aria-label="t('dashboard.quickOpen.clear')"
              :title="t('dashboard.quickOpen.clear')"
              @click="clearInput"
            >
              <XIcon v-once :size="16" />
            </button>
            <button
              class="button is-light is-small quick-open-paste"
              type="button"
              :disabled="isReadingClipboard"
              @click="pasteClipboard"
            >
              <ClipboardPasteIcon v-once :size="16" />
              <span>{{ t('dashboard.quickOpen.paste') }}</span>
            </button>
          </div>

          <div v-if="errorMessage" class="quick-open-message quick-open-message--danger">
            <AlertCircleIcon v-once :size="16" />
            <span>{{ errorMessage }}</span>
          </div>

          <button
            v-else-if="targetPreview"
            class="quick-open-result"
            type="submit"
            :disabled="isOpening"
          >
            <span class="quick-open-result__icon">
              <component :is="targetIcon" :size="18" />
            </span>
            <span class="quick-open-result__content">
              <span class="quick-open-result__title">{{ targetPreview.title }}</span>
              <span class="quick-open-result__subtitle">{{ targetSubtitle }}</span>
            </span>
            <ArrowRightIcon v-once :size="18" class="quick-open-result__arrow" />
          </button>

          <div v-else class="quick-open-empty">
            <LinkIcon v-once :size="18" />
            <span>
              {{
                t(
                  inputValue.trim()
                    ? 'dashboard.quickOpen.unsupported'
                    : 'dashboard.quickOpen.empty'
                )
              }}
            </span>
          </div>

          <div v-if="recentTargets.length > 0" class="quick-open-recents">
            <div class="quick-open-recents__header">
              <ClockIcon v-once :size="14" />
              <span>{{ t('dashboard.quickOpen.recents') }}</span>
            </div>
            <button
              v-for="recent in recentTargets"
              :key="recent.value"
              class="quick-open-recent"
              type="button"
              @click="openRecentTarget(recent)"
            >
              <span class="quick-open-result__icon quick-open-recent__icon">
                <component :is="getTargetIcon(recent.preview.kind)" :size="16" />
              </span>
              <span class="quick-open-result__content">
                <span class="quick-open-result__title">{{ recent.preview.title }}</span>
                <span class="quick-open-result__subtitle">
                  {{ getTargetSubtitle(recent.preview) }}
                </span>
              </span>
              <ArrowRightIcon v-once :size="16" class="quick-open-result__arrow" />
            </button>
          </div>
        </form>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import {
  AlertCircleIcon,
  ArrowRightIcon,
  BookMarkedIcon,
  ClockIcon,
  ClipboardPasteIcon,
  FileTextIcon,
  GitPullRequestIcon,
  LinkIcon,
  MessageCircleIcon,
  SearchIcon,
  XIcon,
} from 'lucide-vue-next';
import { computed, nextTick, onMounted, shallowRef, useTemplateRef, watch } from 'vue';
import type { Component } from 'vue';

import {
  createDashboardQuickOpenRecent,
  DASHBOARD_QUICK_OPEN_RECENTS_STORAGE_KEY,
  buildDashboardQuickOpenPreview,
  normalizeDashboardQuickOpenRecents,
  upsertDashboardQuickOpenRecent,
} from '~/utils/dashboard-quick-open-utils';
import type { DashboardQuickOpenTargetKind } from '~/utils/dashboard-quick-open-utils';
import type {
  DashboardQuickOpenPreview,
  DashboardQuickOpenRecent,
} from '~/utils/dashboard-quick-open-utils';

const { t } = useI18n();
const { readClipboardText } = useClipboardReader();
const { resolveDashboardUrlTarget, navigateToDashboardUrl } = useDashboardUrlNavigation();

const isOpen = shallowRef(false);
const inputValue = shallowRef('');
const errorMessage = shallowRef('');
const isOpening = shallowRef(false);
const isReadingClipboard = shallowRef(false);
const recentTargets = shallowRef<DashboardQuickOpenRecent[]>([]);
const inputRef = useTemplateRef<HTMLInputElement>('inputRef');

const resolvedTarget = computed(() => resolveDashboardUrlTarget(inputValue.value));
const targetPreview = computed(() => buildDashboardQuickOpenPreview(resolvedTarget.value));
const trimmedInputValue = computed(() => inputValue.value.trim());

const iconByKind: Record<DashboardQuickOpenTargetKind, Component> = {
  issue: AlertCircleIcon,
  'pull-request': GitPullRequestIcon,
  'pull-request-diff': GitPullRequestIcon,
  discussion: MessageCircleIcon,
  repository: BookMarkedIcon,
  file: FileTextIcon,
};

const getTargetIcon = (kind: DashboardQuickOpenTargetKind) => iconByKind[kind];

const getTargetSubtitle = (preview: DashboardQuickOpenPreview) => {
  const keyByKind: Record<DashboardQuickOpenTargetKind, string> = {
    issue: 'dashboard.quickOpen.kind.issue',
    'pull-request': 'dashboard.quickOpen.kind.pullRequest',
    'pull-request-diff': 'dashboard.quickOpen.kind.pullRequestDiff',
    discussion: 'dashboard.quickOpen.kind.discussion',
    repository: 'dashboard.quickOpen.kind.repository',
    file: 'dashboard.quickOpen.kind.file',
  };

  return `${t(keyByKind[preview.kind])} - ${preview.subtitle}`;
};

const targetIcon = computed(() => {
  return targetPreview.value ? getTargetIcon(targetPreview.value.kind) : LinkIcon;
});

const targetSubtitle = computed(() => {
  return targetPreview.value ? getTargetSubtitle(targetPreview.value) : '';
});

const loadRecentTargets = () => {
  if (!import.meta.client) {
    return;
  }

  try {
    recentTargets.value = normalizeDashboardQuickOpenRecents(
      JSON.parse(localStorage.getItem(DASHBOARD_QUICK_OPEN_RECENTS_STORAGE_KEY) ?? '[]')
    );
  } catch {
    recentTargets.value = [];
  }
};

const saveRecentTargets = () => {
  if (!import.meta.client) {
    return;
  }

  localStorage.setItem(
    DASHBOARD_QUICK_OPEN_RECENTS_STORAGE_KEY,
    JSON.stringify(recentTargets.value)
  );
};

const rememberRecentTarget = (value: string) => {
  const target = resolveDashboardUrlTarget(value);
  if (!target) {
    return;
  }

  const recent = createDashboardQuickOpenRecent(value, target);
  if (!recent) {
    return;
  }

  recentTargets.value = upsertDashboardQuickOpenRecent(recentTargets.value, recent);
  saveRecentTargets();
};

const focusInput = () => {
  nextTick(() => {
    inputRef.value?.focus();
    inputRef.value?.select();
  });
};

const open = (initialValue = '') => {
  loadRecentTargets();
  inputValue.value = initialValue;
  errorMessage.value = '';
  isOpen.value = true;
  focusInput();
};

const close = () => {
  isOpen.value = false;
  errorMessage.value = '';
  isOpening.value = false;
};

const clearInput = () => {
  inputValue.value = '';
  errorMessage.value = '';
  focusInput();
};

const pasteClipboard = async () => {
  isReadingClipboard.value = true;
  errorMessage.value = '';

  try {
    const text = (await readClipboardText())?.trim() ?? '';
    if (!text) {
      errorMessage.value = t('dashboard.quickOpen.clipboardEmpty');
      return;
    }

    inputValue.value = text;
    if (!resolveDashboardUrlTarget(text)) {
      errorMessage.value = t('dashboard.quickOpen.clipboardUnsupported');
    }
  } finally {
    isReadingClipboard.value = false;
    focusInput();
  }
};

const openTarget = async () => {
  const value = trimmedInputValue.value;

  if (!value) {
    errorMessage.value = t('dashboard.quickOpen.emptyInput');
    focusInput();
    return;
  }

  if (!resolvedTarget.value) {
    errorMessage.value = t('dashboard.quickOpen.unsupported');
    focusInput();
    return;
  }

  isOpening.value = true;
  errorMessage.value = '';

  try {
    await navigateToDashboardUrl(value);
    rememberRecentTarget(value);
    close();
  } catch (error) {
    console.error('Failed to quick-open GitHub URL in NekoGit.', error);
    errorMessage.value = t('dashboard.quickOpen.openFailed');
  } finally {
    isOpening.value = false;
  }
};

const openRecentTarget = async (recent: DashboardQuickOpenRecent) => {
  inputValue.value = recent.value;
  await openTarget();
};

watch(trimmedInputValue, () => {
  if (errorMessage.value) {
    errorMessage.value = '';
  }
});

onMounted(() => {
  loadRecentTargets();
});

defineExpose({
  open,
  close,
});
</script>

<style scoped lang="scss">
.quick-open-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: clamp(3rem, 10vh, 7rem) 1rem 1rem;
  background: var(--nekogit-overlay-bg);
}

.quick-open-panel {
  width: min(44rem, 100%);
  overflow: hidden;
  border: 1px solid var(--nekogit-border-strong);
  border-radius: var(--nekogit-radius-lg);
  background: var(--nekogit-surface);
  box-shadow: var(--nekogit-shadow-raised);
}

.quick-open-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1rem 0.75rem;
  border-bottom: 1px solid var(--nekogit-border);
  background: var(--nekogit-surface-muted);
}

.quick-open-kicker {
  margin: 0 0 0.15rem;
  color: var(--nekogit-text-muted);
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
}

.quick-open-title {
  margin: 0;
  color: var(--nekogit-text-strong);
  font-size: 1.05rem;
  font-weight: 700;
  line-height: 1.2;
}

.quick-open-icon-button {
  width: 2rem;
  height: 2rem;
  padding: 0;
  color: var(--nekogit-text-muted);
}

.quick-open-search {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 0.5rem;
  padding: 0.95rem 1rem;
}

.quick-open-search__icon {
  color: var(--nekogit-text-subtle);
}

.quick-open-input {
  min-width: 0;
  border-color: var(--nekogit-input-border);
  background: var(--nekogit-input-bg);
  color: var(--nekogit-text-strong);
  font-family: var(--nekogit-code-font-family);
  font-size: 0.92rem;
}

.quick-open-input-action {
  width: 2rem;
  height: 2rem;
  padding: 0;
  color: var(--nekogit-text-muted);
}

.quick-open-paste {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  white-space: nowrap;
}

.quick-open-message,
.quick-open-empty,
.quick-open-result {
  margin: 0 1rem 1rem;
}

.quick-open-message,
.quick-open-empty {
  display: flex;
  min-height: 3rem;
  align-items: center;
  gap: 0.55rem;
  border: 1px solid var(--nekogit-border);
  border-radius: var(--nekogit-radius-md);
  padding: 0.75rem 0.85rem;
  color: var(--nekogit-text-muted);
  font-size: 0.9rem;
}

.quick-open-message--danger {
  border-color: rgba(207, 34, 46, 0.24);
  background: var(--nekogit-danger-soft);
  color: var(--nekogit-danger);
}

.quick-open-result {
  display: grid;
  width: calc(100% - 2rem);
  min-height: 4rem;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.75rem;
  border: 1px solid var(--nekogit-border);
  border-radius: var(--nekogit-radius-md);
  padding: 0.75rem 0.85rem;
  background: var(--nekogit-surface-raised);
  color: inherit;
  cursor: pointer;
  text-align: left;
  transition:
    background-color 0.16s ease,
    border-color 0.16s ease,
    box-shadow 0.16s ease;
}

.quick-open-result:hover,
.quick-open-result:focus-visible {
  border-color: rgba(31, 111, 235, 0.36);
  background: var(--nekogit-surface-hover);
  box-shadow: var(--nekogit-shadow-card-hover);
}

.quick-open-result__icon {
  display: inline-flex;
  width: 2rem;
  height: 2rem;
  align-items: center;
  justify-content: center;
  border-radius: var(--nekogit-radius-md);
  background: var(--nekogit-info-soft);
  color: var(--nekogit-info);
}

.quick-open-result__content {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.15rem;
}

.quick-open-result__title {
  overflow: hidden;
  color: var(--nekogit-text-strong);
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quick-open-result__subtitle {
  overflow: hidden;
  color: var(--nekogit-text-muted);
  font-size: 0.82rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quick-open-result__arrow {
  color: var(--nekogit-text-subtle);
}

.quick-open-recents {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  padding: 0 1rem 1rem;
}

.quick-open-recents__header {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  color: var(--nekogit-text-muted);
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
}

.quick-open-recent {
  display: grid;
  width: 100%;
  min-height: 3.4rem;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.7rem;
  border: 1px solid var(--nekogit-border);
  border-radius: var(--nekogit-radius-md);
  padding: 0.65rem 0.75rem;
  background: var(--nekogit-surface);
  color: inherit;
  cursor: pointer;
  text-align: left;
}

.quick-open-recent:hover,
.quick-open-recent:focus-visible {
  border-color: rgba(31, 111, 235, 0.28);
  background: var(--nekogit-surface-hover);
}

.quick-open-recent__icon {
  width: 1.75rem;
  height: 1.75rem;
}

.quick-open-enter-active,
.quick-open-leave-active {
  transition: opacity 0.14s ease;

  .quick-open-panel {
    transition: transform 0.14s ease;
  }
}

.quick-open-enter-from,
.quick-open-leave-to {
  opacity: 0;

  .quick-open-panel {
    transform: translateY(-0.5rem);
  }
}

@media screen and (max-width: 520px) {
  .quick-open-search {
    grid-template-columns: auto minmax(0, 1fr) auto;
  }

  .quick-open-paste {
    grid-column: 2 / -1;
    justify-content: center;
  }
}
</style>
