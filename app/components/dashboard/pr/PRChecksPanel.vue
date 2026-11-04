<!-- PRChecksPanel — Sidebar panel listing PR check runs with status, duration, logs link and re-run. -->
<script setup lang="ts">
import {
  AlertCircleIcon,
  CheckCircleIcon,
  ClockIcon,
  ExternalLinkIcon,
  Loader2Icon,
  PlayIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  XCircleIcon,
} from 'lucide-vue-next';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import getFetchErrorMessage from '~/utils/getFetchErrorMessage';

interface CheckRun {
  id: number;
  name: string;
  head_sha: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion: string | null;
  html_url: string;
  details_url: string;
  output: { title: string; summary: string; text: string };
  app: { name: string };
}

interface CombinedStatusEntry {
  context: string;
  state: string;
  description: string | null;
  target_url?: string | null;
}

interface CombinedStatus {
  state: string;
  statuses: CombinedStatusEntry[];
}

interface ChecksResponse {
  check_runs: CheckRun[];
  total_count: number;
  combined_status: CombinedStatus;
}

const props = defineProps<{
  owner: string;
  repo: string;
  pullNumber: number;
}>();

const { t } = useI18n();
const apiFetch = useNekoGitApiFetch();

const checkRuns = ref<CheckRun[]>([]);
const loading = ref(false);
const error = ref('');
const rerunningRunId = ref<number | null>(null);
const totalCount = ref(0);
const refreshing = ref(false);
const combinedStatus = ref<CombinedStatus | null>(null);

const statuses = computed(() => combinedStatus.value?.statuses ?? []);
const displayTotalCount = computed(() => totalCount.value + statuses.value.length);

const summary = computed(() => {
  const total = checkRuns.value.length;
  const passing = checkRuns.value.filter(
    (r) => r.status === 'completed' && r.conclusion === 'success'
  ).length;
  const skipped = checkRuns.value.filter(
    (r) => r.status === 'completed' && (r.conclusion === 'skipped' || r.conclusion === 'neutral')
  ).length;
  const failing = checkRuns.value.filter(
    (r) =>
      r.status === 'completed' &&
      r.conclusion &&
      r.conclusion !== 'success' &&
      r.conclusion !== 'skipped' &&
      r.conclusion !== 'neutral'
  ).length;
  const pending = checkRuns.value.filter((r) => r.status !== 'completed').length;
  return { total, passing, failing, pending, skipped };
});

const combinedStateLabel = computed(() => {
  const state = combinedStatus.value?.state;
  if (state === 'success') return t('prReview.ciChecks.passed');
  if (state === 'failure' || state === 'error') return t('prReview.ciChecks.failed');
  if (state === 'pending') return t('prReview.ciChecks.pending');
  return state || '';
});

const combinedStateClass = computed(() => {
  const state = combinedStatus.value?.state;
  if (state === 'success') return 'pass';
  if (state === 'failure' || state === 'error') return 'fail';
  return 'pending';
});

const getCheckIcon = (run: CheckRun) => {
  if (run.status !== 'completed') return ClockIcon;
  if (run.conclusion === 'success') return CheckCircleIcon;
  if (
    run.conclusion === 'failure' ||
    run.conclusion === 'timed_out' ||
    run.conclusion === 'cancelled'
  )
    return XCircleIcon;
  if (run.conclusion === 'skipped' || run.conclusion === 'neutral') return AlertCircleIcon;
  return ClockIcon;
};

const getCheckIconClass = (run: CheckRun) => {
  if (run.status !== 'completed') return 'check-icon--pending';
  if (run.conclusion === 'success') return 'check-icon--success';
  if (
    run.conclusion === 'failure' ||
    run.conclusion === 'timed_out' ||
    run.conclusion === 'cancelled'
  )
    return 'check-icon--failure';
  if (run.conclusion === 'skipped' || run.conclusion === 'neutral') return 'check-icon--skipped';
  return 'check-icon--pending';
};

const getConclusionLabel = (run: CheckRun) => {
  if (run.status !== 'completed')
    return run.status === 'queued'
      ? t('prReview.ciChecks.queued')
      : t('prReview.ciChecks.inProgress');
  if (run.conclusion === 'success') return t('prReview.ciChecks.passed');
  if (run.conclusion === 'failure') return t('prReview.ciChecks.failed');
  if (run.conclusion === 'timed_out') return t('prReview.ciChecks.timedOut');
  if (run.conclusion === 'cancelled') return t('prReview.ciChecks.cancelled');
  if (run.conclusion === 'skipped') return t('prReview.ciChecks.skipped');
  if (run.conclusion === 'neutral') return t('prReview.ciChecks.neutral');
  return run.conclusion || '';
};

const getStatusIcon = (status: CombinedStatusEntry) => {
  if (status.state === 'success') return CheckCircleIcon;
  if (status.state === 'failure' || status.state === 'error') return XCircleIcon;
  return ClockIcon;
};

const getStatusIconClass = (status: CombinedStatusEntry) => {
  if (status.state === 'success') return 'check-icon--success';
  if (status.state === 'failure' || status.state === 'error') return 'check-icon--failure';
  return 'check-icon--pending';
};

const getStatusStateLabel = (status: CombinedStatusEntry) => {
  if (status.state === 'success') return t('prReview.ciChecks.passed');
  if (status.state === 'failure' || status.state === 'error') return t('prReview.ciChecks.failed');
  if (status.state === 'pending') return t('prReview.ciChecks.pending');
  return status.state;
};

const getStatusDescription = (status: CombinedStatusEntry) => {
  const stateLabel = getStatusStateLabel(status);
  return status.description ? `${stateLabel} · ${status.description}` : stateLabel;
};

const openStatusTarget = (status: CombinedStatusEntry) => {
  if (status.target_url) {
    window.open(status.target_url, '_blank', 'noopener,noreferrer');
  }
};

const canRerun = (run: CheckRun) => {
  return (
    run.status === 'completed' &&
    run.conclusion &&
    run.conclusion !== 'success' &&
    run.conclusion !== 'skipped' &&
    run.conclusion !== 'neutral'
  );
};

const rerunCheck = async (run: CheckRun) => {
  rerunningRunId.value = run.id;
  try {
    await apiFetch(
      `/api/repos/${props.owner}/${props.repo}/pulls/${props.pullNumber}/checks/${run.id}/rerun`,
      { method: 'POST' }
    );
    await fetchChecks();
  } catch (err: unknown) {
    console.error('Failed to rerun check:', err);
    error.value = getFetchErrorMessage(err, t('prReview.ciChecks.rerunFailed'));
  } finally {
    rerunningRunId.value = null;
  }
};

const openLogs = (run: CheckRun) => {
  if (run.html_url) {
    window.open(run.html_url, '_blank', 'noopener,noreferrer');
  }
};

const fetchChecks = async (silent = false) => {
  if (!props.owner || !props.repo || !props.pullNumber) return;

  if (silent) {
    if (refreshing.value || loading.value) return;
    refreshing.value = true;
  } else {
    loading.value = true;
  }
  error.value = '';

  try {
    const data = await apiFetch<ChecksResponse>(
      `/api/repos/${props.owner}/${props.repo}/pulls/${props.pullNumber}/checks`,
      { method: 'GET' }
    );
    checkRuns.value = data?.check_runs || [];
    totalCount.value = data?.total_count ?? checkRuns.value.length;
    combinedStatus.value = data?.combined_status ?? null;
  } catch (err: unknown) {
    console.error('Error fetching PR checks:', err);
    error.value = getFetchErrorMessage(err, t('prReview.ciChecks.failedToLoad'));
    checkRuns.value = [];
    totalCount.value = 0;
    combinedStatus.value = null;
  } finally {
    if (silent) {
      refreshing.value = false;
    } else {
      loading.value = false;
    }
  }
};

watch(
  () => [props.owner, props.repo, props.pullNumber] as const,
  () => {
    fetchChecks();
  },
  { immediate: true }
);

let refreshTimer: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  refreshTimer = setInterval(() => {
    fetchChecks(true);
  }, 30000);
});

onBeforeUnmount(() => {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
});
</script>

<template>
  <div class="sidebar-card mt-4">
    <div class="sidebar-card__header">
      <div class="sidebar-card__header-left">
        <PlayIcon :size="14" class="sidebar-card__icon" />
        <span class="sidebar-card__title">{{ t('prReview.ciChecks.checks') }}</span>
      </div>
      <div class="sidebar-card__header-actions">
        <span v-if="!loading" class="sidebar-badge">{{ displayTotalCount }}</span>
        <button
          class="checks-refresh"
          type="button"
          :disabled="loading"
          :title="t('prReview.ciChecks.refresh')"
          @click="fetchChecks()"
        >
          <RefreshCwIcon :size="13" />
        </button>
      </div>
    </div>
    <div class="sidebar-card__content">
      <div v-if="loading" class="checks-loading">
        <Loader2Icon :size="14" class="spin-animation" />
        <span>{{ t('prReview.ciChecks.loading') }}</span>
      </div>

      <div v-else-if="error" class="sidebar-card__error">
        {{ error }}
      </div>

      <div v-else-if="checkRuns.length === 0 && statuses.length === 0" class="sidebar-card__empty">
        {{ t('prReview.ciChecks.noChecks') }}
      </div>

      <template v-else>
        <div class="checks-summary">
          <span
            v-if="combinedStatus"
            :class="['checks-summary__item', `checks-summary__item--${combinedStateClass}`]"
          >
            {{ t('prReview.ciChecks.overall') }}: {{ combinedStateLabel }}
          </span>
          <span v-if="summary.passing > 0" class="checks-summary__item checks-summary__item--pass">
            {{ summary.passing }} {{ t('prReview.ciChecks.passing') }}
          </span>
          <span v-if="summary.failing > 0" class="checks-summary__item checks-summary__item--fail">
            {{ summary.failing }} {{ t('prReview.ciChecks.failing') }}
          </span>
          <span
            v-if="summary.pending > 0"
            class="checks-summary__item checks-summary__item--pending"
          >
            {{ summary.pending }} {{ t('prReview.ciChecks.pending') }}
          </span>
          <span
            v-if="summary.skipped > 0"
            class="checks-summary__item checks-summary__item--skipped"
          >
            {{ summary.skipped }} {{ t('prReview.ciChecks.skipped') }}
          </span>
        </div>

        <div class="checks-list">
          <div v-for="run in checkRuns" :key="run.id" class="check-item">
            <div class="check-item__icon">
              <component :is="getCheckIcon(run)" :size="14" :class="getCheckIconClass(run)" />
            </div>
            <div class="check-item__body">
              <span class="check-item__name">{{ run.name }}</span>
              <span class="check-item__conclusion">{{ getConclusionLabel(run) }}</span>
            </div>
            <div class="check-item__actions">
              <button
                v-if="canRerun(run)"
                class="check-item__action"
                type="button"
                :disabled="rerunningRunId === run.id"
                :title="t('prReview.ciChecks.rerun')"
                @click="rerunCheck(run)"
              >
                <Loader2Icon v-if="rerunningRunId === run.id" :size="13" class="spin-animation" />
                <RotateCcwIcon v-else :size="13" />
              </button>
              <button
                v-if="run.html_url"
                class="check-item__action"
                type="button"
                :title="t('prReview.ciChecks.viewLogs')"
                @click="openLogs(run)"
              >
                <ExternalLinkIcon :size="13" />
              </button>
            </div>
          </div>

          <div
            v-for="(status, index) in statuses"
            :key="`${status.context}-${index}`"
            class="check-item"
          >
            <div class="check-item__icon">
              <component
                :is="getStatusIcon(status)"
                :size="14"
                :class="getStatusIconClass(status)"
              />
            </div>
            <div class="check-item__body">
              <span class="check-item__name">{{ status.context }}</span>
              <span class="check-item__conclusion">{{ getStatusDescription(status) }}</span>
            </div>
            <div class="check-item__actions">
              <button
                v-if="status.target_url"
                class="check-item__action"
                type="button"
                :title="t('prReview.ciChecks.viewLogs')"
                @click="openStatusTarget(status)"
              >
                <ExternalLinkIcon :size="13" />
              </button>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

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

.sidebar-card__header-actions {
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
  letter-spacing: 0;
}

.sidebar-card__content {
  padding: 12px 16px;
}

.sidebar-card__empty {
  font-size: 12px;
  color: var(--nekogit-text-subtle);
  margin: 0;
}

.sidebar-card__error {
  margin: 0;
  font-size: 11px;
  color: var(--bulma-danger, #cc0f35);
}

.sidebar-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  font-size: 11px;
  font-weight: 600;
  color: var(--nekogit-text-muted);
  background: var(--nekogit-surface-hover);
  border-radius: 10px;
}

.checks-refresh {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  color: var(--nekogit-text-muted);
  background: transparent;
  border: 0;
  border-radius: 4px;
  cursor: pointer;
  opacity: 0.6;

  &:hover:not(:disabled) {
    color: var(--bulma-text-strong, var(--nekogit-text-strong));
    background: var(--nekogit-surface-hover);
    opacity: 1;
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
}

.checks-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--nekogit-text-muted);
}

.checks-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
}

.checks-summary__item {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;

  &--pass {
    color: var(--nekogit-success);
    background: var(--nekogit-success-soft);
  }

  &--fail {
    color: var(--nekogit-danger);
    background: var(--nekogit-danger-soft);
  }

  &--pending {
    color: var(--nekogit-warning);
    background: var(--nekogit-warning-soft);
  }

  &--skipped {
    color: var(--nekogit-text-muted);
    background: var(--nekogit-surface-hover);
  }
}

.checks-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.check-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  background: var(--nekogit-surface);
  border: 1px solid var(--nekogit-border);
  border-radius: 6px;
  transition: all 0.12s ease;

  &:hover {
    border-color: var(--nekogit-border-strong);
  }
}

.check-item__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 18px;
  height: 18px;
}

.check-icon--success {
  color: var(--nekogit-success);
}

.check-icon--failure {
  color: var(--nekogit-danger);
}

.check-icon--pending {
  color: var(--nekogit-warning);
}

.check-icon--skipped {
  color: var(--nekogit-text-muted);
}

.check-item__body {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 1px;
}

.check-item__name {
  font-size: 12px;
  font-weight: 500;
  color: var(--bulma-text-strong, var(--nekogit-text-strong));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.3;
}

.check-item__conclusion {
  font-size: 10px;
  color: var(--nekogit-text-subtle);
  line-height: 1.3;
}

.check-item__actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.check-item__action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  color: var(--nekogit-text-muted);
  background: transparent;
  border: 0;
  border-radius: 4px;
  cursor: pointer;
  opacity: 0.6;

  &:hover:not(:disabled) {
    color: var(--bulma-text-strong, var(--nekogit-text-strong));
    background: var(--nekogit-surface-hover);
    opacity: 1;
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
}

.spin-animation {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
