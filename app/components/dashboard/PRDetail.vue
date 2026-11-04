<!-- PRDetail — Pull request detail page: header, timeline, sidebar actions, and integrated review workspace. -->
<template>
  <div :class="['pr-detail-layout', { 'pr-detail-layout--review': isReviewWindowOpen }]">
    <PRReviewWorkspace
      v-if="isReviewWindowOpen"
      :owner="repoOwner"
      :repo="repoName"
      :pull-number="currentPullRequest?.number || 0"
      :commit-id="reviewCommitId"
      :title="currentPullRequest?.title"
      :commits="reviewCommits"
      :commits-loading="reviewCommitsLoading"
      @close="closeReviewWindow"
    />

    <div v-else class="columns">
      <div class="column detail-main-column">
        <div v-if="detailError" class="notification is-danger is-light mb-4 py-2 px-3">
          <p class="is-size-7">{{ detailError }}</p>
        </div>

        <PRHeader
          :pull-request="currentPullRequest"
          :repo-owner="repoOwner"
          :repo-name="repoName"
          :commit-id="reviewCommitId"
          :mergeable="currentPullRequest?.mergeable ?? null"
          :can-merge="canMerge"
          @approve="handleApprove"
          @request-changes="handleRequestChanges"
          @merge="handleMerge"
          @close-pr="handleClosePr"
          @reopen-pr="handleReopenPr"
          @edit-pr="openPrEditModal"
          @convert-to-draft="handleConvertToDraft"
          @mark-ready="handleMarkReady"
        />

        <hr />

        <div class="pr-detail__timeline mt-4">
          <PRTimelineEvents
            :timeline="timeline"
            :loading="loadingTimeline"
            :repo-owner="repoOwner"
            :repo-name="repoName"
            :pull-number="currentPullRequest?.number || 0"
            :has-next-page="hasNextTimelinePage"
            :loading-more="loadingMoreTimeline"
            :resolving-review-thread-id="resolvingReviewThreadId"
            :replying-review-thread-id="replyingReviewThreadId"
            :review-thread-reply-result="reviewThreadReplyResult"
            @switch-issue="switchToIssue"
            @switch-pull-request="switchToPullRequest"
            @comment-created="addTimelineEvent"
            @load-more="loadMoreTimeline"
            @toggle-review-thread="toggleReviewThreadResolved"
            @reply-to-review-thread="handleReplyToReviewThread"
          />
        </div>
      </div>

      <div class="column detail-sidebar-column">
        <div
          class="sidebar-scroll"
          :class="{ 'sidebar-scroll--active': isSidebarScrolling }"
          @scroll="onSidebarScroll"
        >
          <PRLabels
            :labels="currentPullRequest?.labels || []"
            :can-edit-labels="canEditLabels"
            :repo-info="repoInfo"
            :pr-number="currentPullRequest?.number || null"
            @update:labels="updateLabels"
          />

          <PRActions
            :requested-reviewers="currentPullRequest?.requested_reviewers || []"
            :requested-teams="currentPullRequest?.requested_teams || []"
            :reviewers="currentPullRequest?.reviewers"
            :reviewer-error="reviewerPickerError"
            :can-request-reviewers="canRequestReviewers"
            :html-url="currentPullRequest?.html_url"
            :created-at="currentPullRequest?.created_at"
            :updated-at="currentPullRequest?.updated_at"
            :merged-at="currentPullRequest?.merged_at"
            :assignee="currentPullRequest?.assignee"
            :commits="currentPullRequest?.commits"
            :changed-files="currentPullRequest?.changed_files"
            :additions="currentPullRequest?.additions"
            :deletions="currentPullRequest?.deletions"
            @open-reviewers="openReviewerPicker"
            @request-reviewer="rerequestReviewer"
            @remove-reviewer="removeReviewerRequest"
          />

          <PRChecksPanel
            :owner="repoOwner"
            :repo="repoName"
            :pull-number="currentPullRequest?.number || 0"
          />

          <PREditModal
            :visible="isPrEditModalOpen"
            :title="currentPullRequest?.title"
            :body="currentPullRequest?.body"
            :saving="savingPrEdit"
            :error="prEditError"
            @close="closePrEditModal"
            @save="handleSavePrEdit"
          />

          <PRReviewerRequestModal
            :is-visible="isReviewerPickerOpen"
            :candidates="reviewerCandidates"
            :warnings="reviewerCandidateWarnings"
            :loading="loadingReviewerCandidates"
            :submitting="submittingReviewerRequest"
            :error="reviewerPickerError"
            @close="closeReviewerPicker"
            @search="loadReviewerCandidates"
            @submit="requestReviewerSelection"
            @clear-error="clearReviewerPickerError"
          />

          <div class="sidebar-card mt-4">
            <div class="sidebar-card__content">
              <button
                class="sidebar-review-btn"
                type="button"
                :disabled="!canOpenReviewWindow"
                @click="openReviewWindow"
              >
                <EyeIcon :size="14" />
                <span>{{ t('prReview.openReview') }}</span>
              </button>
            </div>
          </div>

          <div v-if="desktopAvailable" class="sidebar-card mt-4">
            <div class="sidebar-card__content">
              <button
                class="sidebar-review-btn"
                type="button"
                :disabled="checkoutPRLoading"
                @click="checkoutPullRequestLocally"
              >
                <Loader2Icon v-if="checkoutPRLoading" :size="14" class="spin-animation" />
                <GitBranchIcon v-else :size="14" />
                <span>{{
                  checkoutPRLoading ? t('prReview.checkingOut') : t('prReview.checkoutLocally')
                }}</span>
              </button>
              <p v-if="checkoutPRError" class="sidebar-card__error mt-2">
                {{ checkoutPRError }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { EyeIcon, GitBranchIcon, Loader2Icon } from 'lucide-vue-next';
import { computed, onMounted, ref, shallowRef, watch } from 'vue';

import PRActions from '~/components/dashboard/pr/PRActions.vue';
import PRChecksPanel from '~/components/dashboard/pr/PRChecksPanel.vue';
import PREditModal from '~/components/dashboard/pr/PREditModal.vue';
import PRHeader from '~/components/dashboard/pr/PRHeader.vue';
import PRLabels from '~/components/dashboard/pr/PRLabels.vue';
import PRReviewerRequestModal from '~/components/dashboard/pr/PRReviewerRequestModal.vue';
import PRReviewWorkspace from '~/components/dashboard/pr/PRReviewWorkspace.vue';
import PRTimelineEvents from '~/components/dashboard/pr/PRTimelineEvents.vue';
import { useDesktopRuntime } from '~/composables/useDesktopRuntime';
import { createEmptyPRReviewersSummary } from '~/composables/usePRReviewers';
import type {
  PRReviewerCandidate,
  PRReviewerCandidateWarning,
  PRReviewerMutationPayload,
  PRReviewerSummaryItem,
} from '~/composables/usePRReviewers';
import type { PRTimelineItem } from '~/composables/usePRTimelineEvents';
import type { RepoPermissions } from '~/utils/createEmptyRepoPermissions';
import getFetchErrorMessage from '~/utils/getFetchErrorMessage';
import parseGitHubRepoPath from '~/utils/parseGitHubRepoPath';

const props = defineProps<{
  pullRequest: any;
  reviewActive?: boolean;
}>();

type PullMergeMethod = 'merge' | 'squash' | 'rebase';

/** Result of a review thread reply submission. */
interface ReviewThreadReplyResult {
  threadId: string;
  success: boolean;
  error?: string;
}

/** Pull Request Detail Label. */
interface PullRequestDetailLabel {
  id?: number | string;
  name: string;
  color: string;
  description?: string | null;
}

/** PR Timeline Response. */
interface PRTimelineResponse {
  timeline?: PRTimelineItem[];
  pageInfo?: { hasNextPage?: boolean };
}

const emit = defineEmits<{
  (e: 'switch-issue', owner: string, repo: string, issueNumber: number): void;
  (e: 'switch-pull-request', owner: string, repo: string, pullNumber: number): void;
  (e: 'update:review-active', isActive: boolean): void;
  (e: 'open-review'): void;
  (e: 'close-review'): void;
}>();

const loadingTimeline = ref(false);
const currentPullRequest = ref(props.pullRequest);
const detailError = ref('');
const timeline = ref<PRTimelineItem[]>([]);
const timelineRequestId = ref(0);
const detailRequestId = ref(0);
const permissionRequestId = ref(0);
const reviewerCandidateRequestId = ref(0);
const reviewerSummaryRequestId = ref(0);
const currentTimelinePage = ref(1);
const hasNextTimelinePage = ref(false);
const loadingMoreTimeline = ref(false);
const isReviewWindowOpen = shallowRef(false);
const reviewCommits = shallowRef<
  Array<{ sha: string; shortSha: string; message: string; authorName: string; date: string }>
>([]);
const reviewCommitsLoading = shallowRef(false);
const isReviewerPickerOpen = shallowRef(false);
const isPrEditModalOpen = shallowRef(false);
const savingPrEdit = shallowRef(false);
const prEditError = shallowRef('');
const loadingReviewerCandidates = shallowRef(false);
const submittingReviewerRequest = shallowRef(false);
const reviewerRequestsAvailable = shallowRef<boolean | null>(null);
const reviewerPickerError = shallowRef('');
const resolvingReviewThreadId = shallowRef<string | null>(null);
const replyingReviewThreadId = shallowRef<string | null>(null);
const reviewThreadReplyResult = shallowRef<ReviewThreadReplyResult | null>(null);
const reviewerCandidates = ref<PRReviewerCandidate[]>([]);
const reviewerCandidateWarnings = ref<PRReviewerCandidateWarning[]>([]);
const { t } = useI18n();
const apiFetch = useNekoGitApiFetch();
const { fetchReviewerSummary, fetchReviewerCandidates, requestReviewers, removeReviewers } =
  usePRReviewers();

const {
  available: desktopAvailable,
  loadRuntimeInfo,
  checkoutRemoteLocalRepositoryBranch,
  getLocalRepositoryStatus,
} = useDesktopRuntime();
const checkoutPRLoading = shallowRef(false);
const checkoutPRError = shallowRef('');

onMounted(() => {
  void loadRuntimeInfo();
});

/** Confirms a destructive action; SSR never prompts and proceeds. */
const confirmDestructiveAction = (message: string) => {
  if (!import.meta.client) {
    return true;
  }

  return window.confirm(message);
};

const { isScrolling: isSidebarScrolling, onScroll: onSidebarScroll } = useAutoHideScrollState();

const repoPermissions = ref(createEmptyRepoPermissions());

const repoInfo = computed(() => {
  const pullRequest = currentPullRequest.value;

  return (
    parseGitHubRepoPath(pullRequest?.repository_url) ||
    parseGitHubRepoPath(pullRequest?.base?.repo?.url) ||
    parseGitHubRepoPath(pullRequest?.head?.repo?.url) ||
    null
  );
});

const canEditLabels = computed(() => repoPermissions.value.canEditLabels);

const canRequestReviewers = computed(
  () =>
    Boolean(
      repoPermissions.value.admin || repoPermissions.value.maintain || repoPermissions.value.push
    ) && reviewerRequestsAvailable.value !== false
);

const repoOwner = computed(() => repoInfo.value?.owner || '');

const repoName = computed(() => repoInfo.value?.repo || '');

const reviewCommitId = computed(() => currentPullRequest.value?.head?.sha || '');

const canMerge = computed(() => {
  const p = repoPermissions.value;
  return Boolean(p.admin || p.maintain || p.push);
});

const canOpenReviewWindow = computed(() =>
  Boolean(
    repoOwner.value && repoName.value && currentPullRequest.value?.number && reviewCommitId.value
  )
);

const loadReviewCommits = async () => {
  if (!repoOwner.value || !repoName.value || !currentPullRequest.value?.number) return;
  reviewCommitsLoading.value = true;
  try {
    const data = await apiFetch<{ items?: any[] }>(
      `/api/repos/${repoOwner.value}/${repoName.value}/pulls/${currentPullRequest.value.number}/commits`,
      { method: 'GET' }
    );
    const commits = (data?.items ?? []).map((item: any) => ({
      sha: item.sha ?? '',
      shortSha: (item.shortSha ?? (item.sha ?? '').slice(0, 7)) as string,
      message: item.message ?? '(no message)',
      authorName: item.authorName ?? 'Unknown',
      date: item.authorDate ?? '',
    }));
    reviewCommits.value = commits;
  } catch {
    reviewCommits.value = [];
  } finally {
    reviewCommitsLoading.value = false;
  }
};

const openReviewWindow = () => {
  if (!canOpenReviewWindow.value) {
    return;
  }

  isReviewWindowOpen.value = true;
  emit('open-review');
  void loadReviewCommits();
};

const closeReviewWindow = () => {
  isReviewWindowOpen.value = false;
  emit('close-review');
};

const handleApprove = async () => {
  if (!repoInfo.value || !currentPullRequest.value?.number || !reviewCommitId.value) return;
  try {
    const { owner, repo } = repoInfo.value;
    await apiFetch(`/api/repos/${owner}/${repo}/pulls/${currentPullRequest.value.number}/reviews`, {
      method: 'POST',
      body: {
        commitId: reviewCommitId.value,
        event: 'APPROVE',
      },
    });
    await fetchTimeline();
  } catch (err) {
    detailError.value = getFetchErrorMessage(err, 'Failed to approve pull request.');
  }
};

const handleRequestChanges = async () => {
  if (!repoInfo.value || !currentPullRequest.value?.number || !reviewCommitId.value) return;
  try {
    const { owner, repo } = repoInfo.value;
    await apiFetch(`/api/repos/${owner}/${repo}/pulls/${currentPullRequest.value.number}/reviews`, {
      method: 'POST',
      body: {
        commitId: reviewCommitId.value,
        event: 'REQUEST_CHANGES',
        body: t('prReview.eventRequestChanges'),
      },
    });
    await fetchTimeline();
  } catch (err) {
    detailError.value = getFetchErrorMessage(err, 'Failed to request changes.');
  }
};

const openPrEditModal = () => {
  prEditError.value = '';
  isPrEditModalOpen.value = true;
};

const closePrEditModal = () => {
  if (savingPrEdit.value) return;
  isPrEditModalOpen.value = false;
  prEditError.value = '';
};

const handleSavePrEdit = async (payload: { title: string; body: string }) => {
  if (!repoInfo.value || !currentPullRequest.value?.number || savingPrEdit.value) return;

  savingPrEdit.value = true;
  prEditError.value = '';
  try {
    const { owner, repo } = repoInfo.value;
    const data = await apiFetch<Record<string, unknown>>(
      `/api/repos/${owner}/${repo}/pulls/${currentPullRequest.value.number}`,
      {
        method: 'PATCH',
        body: { title: payload.title, body: payload.body },
      }
    );
    if (data) {
      currentPullRequest.value = { ...currentPullRequest.value, ...data };
    }
    isPrEditModalOpen.value = false;
  } catch (error) {
    prEditError.value = getFetchErrorMessage(error, 'Failed to update pull request.');
  } finally {
    savingPrEdit.value = false;
  }
};

const handleMerge = async (method: PullMergeMethod = 'merge') => {
  if (!repoInfo.value || !currentPullRequest.value?.number) return;
  if (!confirmDestructiveAction(`${t('prReview.mergePr')}?`)) return;
  try {
    const { owner, repo } = repoInfo.value;
    const data = await apiFetch<{ merged?: boolean; sha?: string; message?: string }>(
      `/api/repos/${owner}/${repo}/pulls/${currentPullRequest.value.number}`,
      {
        method: 'PATCH',
        body: { merge: true, merge_method: method },
      }
    );
    if (!data) {
      return;
    }

    // The merge endpoint only returns { sha, merged, message }. Apply a local
    // fallback first, then refetch authoritative details; if the refetch fails
    // the fallback state below remains visible.
    currentPullRequest.value = {
      ...currentPullRequest.value,
      ...data,
      ...(data.merged
        ? {
            state: 'closed',
            merged_at: currentPullRequest.value?.merged_at ?? new Date().toISOString(),
          }
        : {}),
    };

    await fetchPullRequestDetails();
    await fetchTimeline();
  } catch (err) {
    detailError.value = getFetchErrorMessage(err, 'Failed to merge pull request.');
  }
};

const handleClosePr = async () => {
  if (!repoInfo.value || !currentPullRequest.value?.number) return;
  if (!confirmDestructiveAction(`${t('prReview.closePr')}?`)) return;
  try {
    const { owner, repo } = repoInfo.value;
    const data = await apiFetch<Record<string, unknown>>(
      `/api/repos/${owner}/${repo}/pulls/${currentPullRequest.value.number}`,
      {
        method: 'PATCH',
        body: { state: 'closed' },
      }
    );
    if (data) {
      currentPullRequest.value = { ...currentPullRequest.value, ...data };
      await fetchTimeline();
    }
  } catch (err) {
    detailError.value = getFetchErrorMessage(err, 'Failed to close pull request.');
  }
};

const handleReopenPr = async () => {
  if (!repoInfo.value || !currentPullRequest.value?.number) return;
  try {
    const { owner, repo } = repoInfo.value;
    const data = await apiFetch<Record<string, unknown>>(
      `/api/repos/${owner}/${repo}/pulls/${currentPullRequest.value.number}`,
      {
        method: 'PATCH',
        body: { state: 'open' },
      }
    );
    if (data) {
      currentPullRequest.value = { ...currentPullRequest.value, ...data };
      await fetchTimeline();
    }
  } catch (err) {
    detailError.value = getFetchErrorMessage(err, 'Failed to reopen pull request.');
  }
};

const updatePullRequestDraft = async (draft: boolean) => {
  if (!repoInfo.value || !currentPullRequest.value?.number) return;
  try {
    const { owner, repo } = repoInfo.value;
    const data = await apiFetch<{ pullRequest?: Record<string, unknown> }>(
      `/api/repos/${owner}/${repo}/pulls/${currentPullRequest.value.number}/draft`,
      {
        method: 'POST',
        body: { draft },
      }
    );

    currentPullRequest.value = {
      ...currentPullRequest.value,
      ...data?.pullRequest,
      draft,
    };

    await fetchPullRequestDetails();
    await fetchTimeline();
  } catch (err) {
    detailError.value = getFetchErrorMessage(err, t('prReview.updateDraftFailed'));
  }
};

const handleConvertToDraft = () => {
  void updatePullRequestDraft(true);
};

const handleMarkReady = () => {
  void updatePullRequestDraft(false);
};

const handleReplyToReviewThread = async (payload: { threadId: string; body: string }) => {
  if (!repoInfo.value || !currentPullRequest.value?.number || replyingReviewThreadId.value) {
    return;
  }

  const body = payload.body.trim();
  if (!body) return;

  const { owner, repo } = repoInfo.value;
  const pullNumber = currentPullRequest.value.number;
  replyingReviewThreadId.value = payload.threadId;
  reviewThreadReplyResult.value = null;

  try {
    await apiFetch(
      `/api/repos/${owner}/${repo}/pulls/${pullNumber}/review-threads/${encodeURIComponent(payload.threadId)}/replies`,
      {
        method: 'POST',
        body: { body },
      }
    );
    reviewThreadReplyResult.value = { threadId: payload.threadId, success: true };
    await fetchTimeline();
  } catch (err) {
    reviewThreadReplyResult.value = {
      threadId: payload.threadId,
      success: false,
      error: getFetchErrorMessage(err, t('prReview.replyFailed')),
    };
  } finally {
    replyingReviewThreadId.value = null;
  }
};

const checkoutPullRequestLocally = async () => {
  const headRef = currentPullRequest.value?.head?.ref;
  if (!headRef || !repoOwner.value || !repoName.value) return;

  checkoutPRLoading.value = true;
  checkoutPRError.value = '';

  try {
    // For fork PRs the head branch lives in the fork, not in the local base clone.
    // Comparing repo full_names prevents checking out an unrelated same-named branch.
    const headRepo = currentPullRequest.value?.head?.repo?.full_name;
    const baseRepo = currentPullRequest.value?.base?.repo?.full_name;
    if (headRepo && baseRepo && String(headRepo).toLowerCase() !== String(baseRepo).toLowerCase()) {
      checkoutPRError.value = t('prReview.checkoutForkHead');
      return;
    }

    // Build the clone URL to check if local repo exists
    const cloneUrl = `https://github.com/${repoOwner.value}/${repoName.value}.git`;
    const status = await getLocalRepositoryStatus(cloneUrl);

    if (!status.exists) {
      checkoutPRError.value = t('prReview.cloneFirst');
      return;
    }

    // The remote branch name is "origin/headRef" or just "headRef"
    // The checkout command accepts "origin/branch-name" or "branch-name"
    await checkoutRemoteLocalRepositoryBranch(cloneUrl, `origin/${headRef}`);
  } catch (error) {
    checkoutPRError.value = error instanceof Error ? error.message : 'Failed to checkout PR branch';
  } finally {
    checkoutPRLoading.value = false;
  }
};

const switchToIssue = (owner: string, repo: string, issueNumber: number) => {
  emit('switch-issue', owner, repo, issueNumber);
};

const switchToPullRequest = (owner: string, repo: string, pullNumber: number) => {
  emit('switch-pull-request', owner, repo, pullNumber);
};

const addTimelineEvent = (event: PRTimelineItem) => {
  timeline.value.push(event);
};

const openReviewerPicker = () => {
  if (!canRequestReviewers.value) {
    return;
  }

  isReviewerPickerOpen.value = true;
  loadReviewerCandidates();
};

const closeReviewerPicker = () => {
  isReviewerPickerOpen.value = false;
};

const invalidateReviewerSummaryRequests = () => {
  reviewerSummaryRequestId.value += 1;
};

const loadReviewerSummary = async () => {
  if (!repoInfo.value || !currentPullRequest.value?.number) {
    return;
  }

  const requestId = reviewerSummaryRequestId.value + 1;
  const pullRequestIdentity = getPullRequestIdentity();
  reviewerSummaryRequestId.value = requestId;

  try {
    const { owner, repo } = repoInfo.value;
    const pullNumber = currentPullRequest.value.number;
    const reviewers = await fetchReviewerSummary(owner, repo, pullNumber);

    if (
      requestId !== reviewerSummaryRequestId.value ||
      pullRequestIdentity !== getPullRequestIdentity() ||
      !currentPullRequest.value
    ) {
      return;
    }

    currentPullRequest.value = {
      ...currentPullRequest.value,
      reviewers,
    };
  } catch (err: unknown) {
    console.error('Error fetching pull request reviewer summary:', err);
    if (
      requestId === reviewerSummaryRequestId.value &&
      pullRequestIdentity === getPullRequestIdentity() &&
      currentPullRequest.value
    ) {
      currentPullRequest.value = {
        ...currentPullRequest.value,
        reviewers: createEmptyPRReviewersSummary([
          {
            source: 'reviewer-summary',
            message: getFetchErrorMessage(err, t('prReview.reviewerPicker.summaryLoadFailed')),
          },
        ]),
      };
    }
  }
};

const loadReviewerCandidates = async (query = '') => {
  if (!repoInfo.value || !currentPullRequest.value?.number) {
    return;
  }

  const requestId = reviewerCandidateRequestId.value + 1;
  const pullRequestIdentity = getPullRequestIdentity();
  reviewerCandidateRequestId.value = requestId;
  loadingReviewerCandidates.value = true;
  reviewerPickerError.value = '';
  reviewerCandidateWarnings.value = [];

  try {
    const { owner, repo } = repoInfo.value;
    const pullNumber = currentPullRequest.value.number;
    const data = await fetchReviewerCandidates(owner, repo, pullNumber, query);

    if (
      requestId !== reviewerCandidateRequestId.value ||
      pullRequestIdentity !== getPullRequestIdentity()
    ) {
      return;
    }

    reviewerCandidates.value = data.items ?? [];
    reviewerCandidateWarnings.value = data.warnings ?? [];
    reviewerRequestsAvailable.value = data.canRequestReviewers;
    if (!data.canRequestReviewers) {
      isReviewerPickerOpen.value = false;
    }
  } catch (err: unknown) {
    console.error('Error fetching pull request reviewer candidates:', err);
    if (requestId === reviewerCandidateRequestId.value) {
      reviewerCandidates.value = [];
      reviewerCandidateWarnings.value = [];
      reviewerPickerError.value = getFetchErrorMessage(
        err,
        t('prReview.reviewerPicker.loadFailed')
      );
    }
  } finally {
    if (requestId === reviewerCandidateRequestId.value) {
      loadingReviewerCandidates.value = false;
    }
  }
};

const requestReviewerSelection = async (payload: PRReviewerMutationPayload) => {
  if (!repoInfo.value || !currentPullRequest.value?.number) {
    return;
  }

  const pullRequestIdentity = getPullRequestIdentity();
  submittingReviewerRequest.value = true;
  reviewerPickerError.value = '';

  try {
    const { owner, repo } = repoInfo.value;
    const pullNumber = currentPullRequest.value.number;
    const data = await requestReviewers(owner, repo, pullNumber, payload);

    if (pullRequestIdentity !== getPullRequestIdentity() || !currentPullRequest.value) {
      return;
    }

    currentPullRequest.value = {
      ...currentPullRequest.value,
      ...(data.pullRequest ?? {}),
      reviewers: data.reviewers ?? currentPullRequest.value.reviewers,
    };
    invalidateReviewerSummaryRequests();
    isReviewerPickerOpen.value = false;
    reviewerCandidates.value = [];
    reviewerCandidateWarnings.value = [];
  } catch (err: unknown) {
    console.error('Error requesting pull request reviewers:', err);
    if (pullRequestIdentity === getPullRequestIdentity()) {
      reviewerPickerError.value = getFetchErrorMessage(
        err,
        t('prReview.reviewerPicker.requestFailed')
      );
    }
  } finally {
    if (pullRequestIdentity === getPullRequestIdentity()) {
      submittingReviewerRequest.value = false;
    }
  }
};

const createReviewerMutationPayload = (
  reviewer: PRReviewerSummaryItem
): PRReviewerMutationPayload => {
  if (reviewer.kind === 'team') {
    return { teamReviewers: reviewer.slug ? [reviewer.slug] : [] };
  }

  return { reviewers: reviewer.login ? [reviewer.login] : [] };
};

const rerequestReviewer = async (reviewer: PRReviewerSummaryItem) => {
  if (!canRequestReviewers.value || reviewer.requested) {
    return;
  }

  const payload = createReviewerMutationPayload(reviewer);
  if (!payload.reviewers?.length && !payload.teamReviewers?.length) {
    return;
  }

  await requestReviewerSelection(payload);
};

const removeReviewerRequest = async (reviewer: PRReviewerSummaryItem) => {
  if (!repoInfo.value || !currentPullRequest.value?.number || !reviewer.removable) {
    return;
  }

  const payload = createReviewerMutationPayload(reviewer);

  if (!payload.reviewers?.length && !payload.teamReviewers?.length) {
    return;
  }

  const pullRequestIdentity = getPullRequestIdentity();
  reviewerPickerError.value = '';

  try {
    const { owner, repo } = repoInfo.value;
    const pullNumber = currentPullRequest.value.number;
    const data = await removeReviewers(owner, repo, pullNumber, payload);

    if (pullRequestIdentity !== getPullRequestIdentity() || !currentPullRequest.value) {
      return;
    }

    currentPullRequest.value = {
      ...currentPullRequest.value,
      ...(data.pullRequest ?? {}),
      reviewers: data.reviewers ?? currentPullRequest.value.reviewers,
    };
    invalidateReviewerSummaryRequests();
    reviewerPickerError.value = '';
  } catch (err: unknown) {
    console.error('Error removing pull request reviewer:', err);
    if (pullRequestIdentity === getPullRequestIdentity()) {
      reviewerPickerError.value = getFetchErrorMessage(
        err,
        t('prReview.reviewerPicker.removeFailed')
      );
    }
  }
};

const clearReviewerPickerError = () => {
  reviewerPickerError.value = '';
};

const updateLabels = (labels: PullRequestDetailLabel[]) => {
  if (currentPullRequest.value) {
    currentPullRequest.value.labels = labels;
  }
};

const getPullRequestIdentity = () => {
  if (!repoOwner.value || !repoName.value || !currentPullRequest.value?.number) return '';
  return `${repoOwner.value}/${repoName.value}/${currentPullRequest.value.number}`;
};

const hasHydratedPullRequestDetails = (pullRequest: Record<string, unknown> | null | undefined) => {
  if (!pullRequest) {
    return false;
  }

  return [
    'requested_reviewers',
    'commits',
    'changed_files',
    'additions',
    'deletions',
    'base',
    'head',
  ].some((key) => key in pullRequest);
};

const resetPullRequestScopedState = (pullRequest: any) => {
  currentPullRequest.value = pullRequest;
  detailError.value = '';
  timeline.value = [];
  repoPermissions.value = createEmptyRepoPermissions();
  currentTimelinePage.value = 1;
  hasNextTimelinePage.value = false;
  loadingMoreTimeline.value = false;
  isReviewWindowOpen.value = false;
  isReviewerPickerOpen.value = false;
  loadingReviewerCandidates.value = false;
  submittingReviewerRequest.value = false;
  resolvingReviewThreadId.value = null;
  replyingReviewThreadId.value = null;
  reviewThreadReplyResult.value = null;
  reviewerRequestsAvailable.value = null;
  reviewerPickerError.value = '';
  reviewerCandidates.value = [];
  reviewerCandidateWarnings.value = [];
  reviewerCandidateRequestId.value += 1;
  invalidateReviewerSummaryRequests();
};

const fetchTimeline = async () => {
  if (!repoInfo.value || !currentPullRequest.value?.number) {
    return;
  }

  const requestId = timelineRequestId.value + 1;
  const pullRequestIdentity = getPullRequestIdentity();
  timelineRequestId.value = requestId;
  loadingTimeline.value = true;
  currentTimelinePage.value = 1;
  hasNextTimelinePage.value = false;

  try {
    const { owner, repo } = repoInfo.value;
    const pullNumber = currentPullRequest.value.number;

    const data = await apiFetch<PRTimelineResponse>(
      `/api/pulls/${owner}/${repo}/${pullNumber}/timeline`,
      {
        method: 'GET',
        query: { page: 1 },
      }
    );

    if (requestId === timelineRequestId.value && pullRequestIdentity === getPullRequestIdentity()) {
      timeline.value = data?.timeline || [];
      hasNextTimelinePage.value = Boolean(data?.pageInfo?.hasNextPage);
    }
  } catch (err: unknown) {
    console.error('Error fetching PR timeline:', err);
    if (requestId === timelineRequestId.value) {
      timeline.value = [];
      hasNextTimelinePage.value = false;
    }
  } finally {
    if (requestId === timelineRequestId.value) {
      loadingTimeline.value = false;
    }
  }
};

const loadMoreTimeline = async () => {
  if (
    !repoInfo.value ||
    !currentPullRequest.value?.number ||
    !hasNextTimelinePage.value ||
    loadingMoreTimeline.value
  ) {
    return;
  }

  const requestId = timelineRequestId.value;
  const pullRequestIdentity = getPullRequestIdentity();
  const nextPage = currentTimelinePage.value + 1;
  loadingMoreTimeline.value = true;

  try {
    const { owner, repo } = repoInfo.value;
    const pullNumber = currentPullRequest.value.number;

    const data = await apiFetch<PRTimelineResponse>(
      `/api/pulls/${owner}/${repo}/${pullNumber}/timeline`,
      {
        method: 'GET',
        query: { page: nextPage },
      }
    );

    if (requestId === timelineRequestId.value && pullRequestIdentity === getPullRequestIdentity()) {
      timeline.value = [...timeline.value, ...(data?.timeline || [])];
      hasNextTimelinePage.value = Boolean(data?.pageInfo?.hasNextPage);
      currentTimelinePage.value = nextPage;
    }
  } catch (err: unknown) {
    console.error('Error loading more PR timeline:', err);
  } finally {
    if (requestId === timelineRequestId.value) {
      loadingMoreTimeline.value = false;
    }
  }
};

const toggleReviewThreadResolved = async (threadId: string, resolved: boolean) => {
  if (!repoInfo.value || !currentPullRequest.value?.number || resolvingReviewThreadId.value) {
    return;
  }

  const pullRequestIdentity = getPullRequestIdentity();
  resolvingReviewThreadId.value = threadId;
  detailError.value = '';

  try {
    const { owner, repo } = repoInfo.value;
    const pullNumber = currentPullRequest.value.number;

    await apiFetch(
      `/api/repos/${owner}/${repo}/pulls/${pullNumber}/review-threads/${encodeURIComponent(threadId)}/resolve`,
      {
        method: 'POST',
        body: { resolved },
      }
    );

    if (pullRequestIdentity === getPullRequestIdentity()) {
      await fetchTimeline();
    }
  } catch (err: unknown) {
    console.error('Error updating pull request review thread:', err);
    if (pullRequestIdentity === getPullRequestIdentity()) {
      detailError.value = getFetchErrorMessage(
        err,
        resolved ? t('prReview.resolveThreadFailed') : t('prReview.unresolveThreadFailed')
      );
    }
  } finally {
    if (pullRequestIdentity === getPullRequestIdentity()) {
      resolvingReviewThreadId.value = null;
    }
  }
};

const fetchRepoPermissions = async () => {
  if (!repoInfo.value || !currentPullRequest.value?.number) return;

  const requestId = permissionRequestId.value + 1;
  permissionRequestId.value = requestId;

  try {
    const { owner, repo } = repoInfo.value;
    const permissionData = await apiFetch<RepoPermissions>(
      `/api/repos/${owner}/${repo}/permissions`,
      {
        method: 'GET',
      }
    );

    if (requestId !== permissionRequestId.value) {
      return;
    }

    if (permissionData) {
      repoPermissions.value = {
        admin: Boolean(permissionData.admin),
        maintain: Boolean(permissionData.maintain),
        push: Boolean(permissionData.push),
        triage: Boolean(permissionData.triage),
        pull: Boolean(permissionData.pull),
        canEditLabels: Boolean(permissionData.canEditLabels),
        canLockIssue: Boolean(permissionData.canLockIssue),
      };
    }
  } catch (err) {
    console.error('Error fetching repository permissions:', err);
    if (requestId === permissionRequestId.value) {
      repoPermissions.value = createEmptyRepoPermissions();
    }
  }
};

const fetchPullRequestDetails = async () => {
  if (!repoInfo.value || !currentPullRequest.value?.number) {
    return;
  }

  const requestId = detailRequestId.value + 1;
  const pullRequestIdentity = getPullRequestIdentity();
  const basePullRequest = currentPullRequest.value;
  detailRequestId.value = requestId;
  detailError.value = '';

  try {
    const { owner, repo } = repoInfo.value;
    const pullNumber = currentPullRequest.value.number;

    const data = await apiFetch<Record<string, unknown>>(
      `/api/pulls/${owner}/${repo}/${pullNumber}`,
      {
        method: 'GET',
      }
    );

    if (requestId === detailRequestId.value && pullRequestIdentity === getPullRequestIdentity()) {
      currentPullRequest.value = { ...basePullRequest, ...data };
      loadReviewerSummary();
    }
  } catch (err: unknown) {
    console.error('Error fetching PR details:', err);
    if (requestId === detailRequestId.value && pullRequestIdentity === getPullRequestIdentity()) {
      currentPullRequest.value = basePullRequest;
      detailError.value = getFetchErrorMessage(err, 'Failed to load pull request details.');
    }
  }
};

watch(
  () => props.pullRequest,
  (newPullRequest) => {
    timelineRequestId.value += 1;
    detailRequestId.value += 1;
    permissionRequestId.value += 1;
    resetPullRequestScopedState(newPullRequest);
    if (newPullRequest) {
      fetchTimeline();
      fetchRepoPermissions();
      if (hasHydratedPullRequestDetails(newPullRequest as Record<string, unknown>)) {
        loadReviewerSummary();
        return;
      }

      fetchPullRequestDetails();
    }
  },
  { immediate: true }
);

watch(
  () => [props.reviewActive, canOpenReviewWindow.value] as const,
  ([shouldOpenReview, canOpen]) => {
    if (shouldOpenReview && canOpen) {
      isReviewWindowOpen.value = true;
      return;
    }

    if (!shouldOpenReview) {
      isReviewWindowOpen.value = false;
    }
  },
  { immediate: true }
);

watch(
  isReviewWindowOpen,
  (isOpen) => {
    emit('update:review-active', isOpen);
  },
  { immediate: true }
);
</script>

<style scoped lang="scss">
.pr-detail-layout :deep(.columns) {
  height: 100%;
  min-height: 0;
  align-items: stretch;
  margin-bottom: 0;
}

.pr-detail-layout :deep(.detail-main-column) {
  height: 100%;
  min-height: 0;
  overflow-y: auto;
  flex: none;
  width: 72%;
}

.pr-detail-layout :deep(.detail-sidebar-column) {
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

.pr-detail-layout {
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.pr-detail-layout--review {
  position: absolute;
  inset: 0;
  min-height: 0;
  overflow: hidden;
}

.pr-detail__timeline {
  padding-bottom: 5rem;
}

.sidebar-card__error {
  margin: 8px 0 0;
  font-size: 11px;
  color: var(--bulma-danger, #cc0f35);
}

.sidebar-review-btn {
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
</style>
