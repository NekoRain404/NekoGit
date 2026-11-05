<!-- Issue Detail — Issue detail page: header, description, timeline and sidebar actions. -->
<template>
  <div class="detail-scroll">
    <div class="columns">
      <div class="column detail-main-column">
        <IssueHeader
          :issue="currentIssue"
          :repo-owner="resolvedRepoOwner"
          :repo-name="resolvedRepoName"
          :can-edit-issue="canEditIssue"
          :is-updating="savingIssue"
          @edit-issue="openEditModal"
          @close-issue="closeIssue"
          @reopen-issue="reopenIssue"
        />

        <div
          v-if="issueActionError"
          class="notification is-danger is-light is-size-7 py-2 px-4 mt-4"
        >
          <button
            class="delete is-small"
            type="button"
            aria-label="close"
            @click="issueActionError = ''"
          ></button>
          {{ issueActionError }}
        </div>

        <hr />

        <div class="issue-detail__timeline mt-4">
          <IssueTimelineEvents
            :timeline="timeline"
            :loading="loadingTimeline"
            :repo-owner="resolvedRepoOwner"
            :repo-name="resolvedRepoName"
            :issue-number="currentIssue.number"
            :has-next-page="hasNextTimelinePage"
            :loading-more="loadingMoreTimeline"
            @switch-issue="switchToIssue"
            @switch-pull-request="switchToPullRequest"
            @comment-created="addTimelineEvent"
            @load-more="loadMoreTimeline"
          />
        </div>
      </div>

      <div class="column detail-sidebar-column">
        <div
          class="sidebar-scroll"
          :class="{ 'sidebar-scroll--active': isSidebarScrolling }"
          @scroll="onSidebarScroll"
        >
          <IssueLabels
            :labels="currentIssue?.labels || []"
            :can-edit-labels="canEditLabels"
            :issue-number="currentIssue?.number || null"
            :repo-info="repoInfo"
            @update:labels="updateLabels"
            @update:is-label-editor-visible="updateLabelEditorVisibility"
          />

          <IssueActions
            :is-locked="isLocked"
            :can-lock-issue="canLockIssue"
            :repo-info="repoInfo"
            :issue-number="currentIssue?.number"
            :html-url="currentIssue?.html_url"
            :created-at="currentIssue?.created_at"
            :updated-at="currentIssue?.updated_at"
            :assignee="currentIssue?.assignee"
            @update:is-locked="updateIsLocked"
            @add-timeline-event="addTimelineEvent"
          />
        </div>
      </div>
    </div>

    <IssueEditModal
      :is-visible="showEditModal"
      :loading="savingIssue"
      :initial-title="currentIssue?.title || ''"
      :initial-body="currentIssue?.body || ''"
      :initial-assignees="issueAssignees"
      :initial-milestone="issueMilestoneNumber"
      :owner="repoOwner"
      :repo="repoName"
      :error="editIssueError"
      @close="closeEditModal"
      @save="saveIssueEdit"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import IssueActions from '~/components/dashboard/issue/IssueActions.vue';
import IssueEditModal from '~/components/dashboard/issue/IssueEditModal.vue';
import IssueHeader from '~/components/dashboard/issue/IssueHeader.vue';
import IssueLabels from '~/components/dashboard/issue/IssueLabels.vue';
import IssueTimelineEvents from '~/components/dashboard/issue/IssueTimelineEvents.vue';
import type { IssueTimelineItem } from '~/composables/useIssueTimelineEvents';
import type { RepoPermissions } from '~/utils/createEmptyRepoPermissions';
import getFetchErrorMessage from '~/utils/getFetchErrorMessage';
import parseGitHubRepoPath from '~/utils/parseGitHubRepoPath';

const props = defineProps<{
  issue: any;
}>();

/** Issue Detail Label. */
interface IssueDetailLabel {
  id?: number | string;
  name: string;
  color: string;
  description?: string | null;
}

const emit = defineEmits<{
  (e: 'switch-issue', owner: string, repo: string, issueNumber: number): void;
  (e: 'switch-pull-request', owner: string, repo: string, pullNumber: number): void;
  (e: 'update:non-sticky-header', visible: boolean): void;
}>();

const loadingTimeline = ref(false);
const loadingPermission = ref(false);
const currentIssue = ref(props.issue);
const repoPermissions = ref(createEmptyRepoPermissions());
const isLocked = ref(props.issue?.locked || false);
const timeline = ref<IssueTimelineItem[]>([]);
const isLabelEditorVisible = ref(false);
const timelineRequestId = ref(0);
const permissionRequestId = ref(0);
const currentTimelinePage = ref(1);
const hasNextTimelinePage = ref(false);
const loadingMoreTimeline = ref(false);
const showEditModal = ref(false);
const savingIssue = ref(false);
const issueActionError = ref('');
const editIssueError = ref('');
const apiFetch = useNekoGitApiFetch();
const { t } = useI18n();
const { openModal, closeModal } = useModalState();

const { isScrolling: isSidebarScrolling, onScroll: onSidebarScroll } = useAutoHideScrollState();

const repoInfo = computed(() => {
  return parseGitHubRepoPath(currentIssue.value?.repository_url);
});

const repoOwner = computed(() => repoInfo.value?.owner);

const repoName = computed(() => repoInfo.value?.repo);

const resolvedRepoOwner = computed(() => repoOwner.value ?? '');

const resolvedRepoName = computed(() => repoName.value ?? '');

const issueAssignees = computed<string[]>(() => {
  const assignees = currentIssue.value?.assignees;

  if (!Array.isArray(assignees)) return [];

  return assignees
    .map((assignee: { login?: unknown } | null | undefined) => assignee?.login)
    .filter((login: unknown): login is string => typeof login === 'string' && login.length > 0);
});

const issueMilestoneNumber = computed<number | null>(() => {
  const number = currentIssue.value?.milestone?.number;

  return Number.isSafeInteger(number) && number > 0 ? number : null;
});

const canEditLabels = computed(() => {
  return repoPermissions.value.canEditLabels;
});

const canLockIssue = computed(() => {
  return repoPermissions.value.canLockIssue;
});

const canEditIssue = computed(() => {
  return repoPermissions.value.canLockIssue;
});

const switchToIssue = (owner: string, repo: string, issueNumber: number) => {
  emit('switch-issue', owner, repo, issueNumber);
};

const switchToPullRequest = (owner: string, repo: string, pullNumber: number) => {
  emit('switch-pull-request', owner, repo, pullNumber);
};

const updateLabels = (labels: IssueDetailLabel[]) => {
  currentIssue.value.labels = labels;
};

const updateIsLocked = (locked: boolean) => {
  isLocked.value = locked;
};

const addTimelineEvent = (event: IssueTimelineItem) => {
  timeline.value.push(event);
};

const confirmIssueAction = (message: string) => {
  if (!import.meta.client) {
    return true;
  }

  return window.confirm(message);
};

const applyUpdatedIssue = (updated: unknown) => {
  if (!updated || typeof updated !== 'object' || Array.isArray(updated)) return;

  const issue = updated as Record<string, unknown>;
  currentIssue.value = { ...currentIssue.value, ...issue };
  isLocked.value = Boolean(issue.locked ?? isLocked.value);
};

const openEditModal = () => {
  if (!canEditIssue.value) return;

  editIssueError.value = '';
  showEditModal.value = true;
  openModal();
};

const closeEditModal = () => {
  if (!showEditModal.value) return;

  showEditModal.value = false;
  closeModal();
};

const saveIssueEdit = async (payload: {
  title: string;
  body: string;
  assignees: string[];
  milestone: number | null;
}) => {
  if (!canEditIssue.value || !repoInfo.value || !currentIssue.value?.number) return;

  savingIssue.value = true;
  issueActionError.value = '';
  editIssueError.value = '';

  try {
    const { owner, repo } = repoInfo.value;
    const data = await apiFetch<Record<string, unknown>>(
      `/api/repos/${owner}/${repo}/issues/${currentIssue.value.number}`,
      {
        method: 'PATCH',
        body: payload,
      }
    );

    applyUpdatedIssue(data);
    closeEditModal();
    await fetchTimeline();
  } catch (err: unknown) {
    console.error('Error updating issue:', err);
    editIssueError.value = getFetchErrorMessage(err, t('issueDetail.failedToUpdateIssue'));
  } finally {
    savingIssue.value = false;
  }
};

const updateIssueState = async (state: 'open' | 'closed') => {
  if (!canEditIssue.value || !repoInfo.value || !currentIssue.value?.number) return;

  const confirmation = t(
    state === 'closed' ? 'issueDetail.confirmCloseIssue' : 'issueDetail.confirmReopenIssue'
  );
  if (!confirmIssueAction(confirmation)) return;

  savingIssue.value = true;
  issueActionError.value = '';

  try {
    const { owner, repo } = repoInfo.value;
    const data = await apiFetch<Record<string, unknown>>(
      `/api/repos/${owner}/${repo}/issues/${currentIssue.value.number}`,
      {
        method: 'PATCH',
        body: { state },
      }
    );

    applyUpdatedIssue(data);
    await fetchTimeline();
  } catch (err: unknown) {
    console.error(`Error updating issue state to ${state}:`, err);
    issueActionError.value = getFetchErrorMessage(
      err,
      t(state === 'closed' ? 'issueDetail.failedToCloseIssue' : 'issueDetail.failedToReopenIssue')
    );
  } finally {
    savingIssue.value = false;
  }
};

const closeIssue = () => updateIssueState('closed');
const reopenIssue = () => updateIssueState('open');

onUnmounted(() => {
  if (showEditModal.value) {
    closeModal();
  }
});

const updateLabelEditorVisibility = (visible: boolean) => {
  isLabelEditorVisible.value = visible;
  emit('update:non-sticky-header', visible);
};

const getIssueIdentity = () => {
  if (!repoOwner.value || !repoName.value || !currentIssue.value?.number) return '';
  return `${repoOwner.value}/${repoName.value}/${currentIssue.value.number}`;
};

const resetIssueScopedState = (issue: any) => {
  closeEditModal();
  issueActionError.value = '';
  editIssueError.value = '';
  currentIssue.value = issue;
  timeline.value = [];
  repoPermissions.value = createEmptyRepoPermissions();
  isLocked.value = issue?.locked || false;
  isLabelEditorVisible.value = false;
  currentTimelinePage.value = 1;
  hasNextTimelinePage.value = false;
  loadingMoreTimeline.value = false;
  emit('update:non-sticky-header', false);
};

const fetchTimeline = async () => {
  if (!repoInfo.value || !currentIssue.value?.number) {
    return;
  }

  const requestId = timelineRequestId.value + 1;
  const issueIdentity = getIssueIdentity();
  timelineRequestId.value = requestId;
  loadingTimeline.value = true;
  currentTimelinePage.value = 1;
  hasNextTimelinePage.value = false;

  try {
    const { owner, repo } = repoInfo.value;
    const issueNumber = currentIssue.value.number;

    const data = await apiFetch<{
      timeline?: IssueTimelineItem[];
      pageInfo?: { hasNextPage?: boolean };
    }>(`/api/issues/${owner}/${repo}/${issueNumber}/timeline`, {
      method: 'GET',
      query: { page: 1 },
    });

    if (requestId === timelineRequestId.value && issueIdentity === getIssueIdentity()) {
      timeline.value = data?.timeline || [];
      hasNextTimelinePage.value = Boolean(data?.pageInfo?.hasNextPage);
    }
  } catch (err: unknown) {
    console.error('Error fetching issue timeline:', err);
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
    !currentIssue.value?.number ||
    !hasNextTimelinePage.value ||
    loadingMoreTimeline.value
  ) {
    return;
  }

  const requestId = timelineRequestId.value;
  const issueIdentity = getIssueIdentity();
  const nextPage = currentTimelinePage.value + 1;
  loadingMoreTimeline.value = true;

  try {
    const { owner, repo } = repoInfo.value;
    const issueNumber = currentIssue.value.number;

    const data = await apiFetch<{
      timeline?: IssueTimelineItem[];
      pageInfo?: { hasNextPage?: boolean };
    }>(`/api/issues/${owner}/${repo}/${issueNumber}/timeline`, {
      method: 'GET',
      query: { page: nextPage },
    });

    if (requestId === timelineRequestId.value && issueIdentity === getIssueIdentity()) {
      timeline.value = [...timeline.value, ...(data?.timeline || [])];
      hasNextTimelinePage.value = Boolean(data?.pageInfo?.hasNextPage);
      currentTimelinePage.value = nextPage;
    }
  } catch (err: unknown) {
    console.error('Error loading more issue timeline:', err);
  } finally {
    if (requestId === timelineRequestId.value) {
      loadingMoreTimeline.value = false;
    }
  }
};

const fetchRepoPermissions = async () => {
  if (!currentIssue.value?.repository_url) return;

  const owner = repoOwner.value;
  const repo = repoName.value;
  if (!owner || !repo) return;

  const requestId = permissionRequestId.value + 1;
  const issueIdentity = getIssueIdentity();
  permissionRequestId.value = requestId;
  loadingPermission.value = true;
  try {
    const permissionData = await apiFetch<RepoPermissions>(
      `/api/repos/${owner}/${repo}/permissions`,
      {
        method: 'GET',
      }
    );

    if (requestId !== permissionRequestId.value || issueIdentity !== getIssueIdentity()) return;

    repoPermissions.value = {
      admin: Boolean(permissionData?.admin),
      maintain: Boolean(permissionData?.maintain),
      push: Boolean(permissionData?.push),
      triage: Boolean(permissionData?.triage),
      pull: Boolean(permissionData?.pull),
      canEditLabels: Boolean(permissionData?.canEditLabels),
      canLockIssue: Boolean(permissionData?.canLockIssue),
    };
  } catch (err) {
    console.error('Error fetching repository permissions:', err);
    if (requestId === permissionRequestId.value) {
      repoPermissions.value = createEmptyRepoPermissions();
    }
  } finally {
    if (requestId === permissionRequestId.value) {
      loadingPermission.value = false;
    }
  }
};

watch(
  () => props.issue,
  (newIssue) => {
    timelineRequestId.value += 1;
    permissionRequestId.value += 1;
    resetIssueScopedState(newIssue);
    if (newIssue) {
      fetchTimeline();
      fetchRepoPermissions();
    }
  },
  { immediate: true }
);
</script>

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

.issue-detail__timeline {
  padding-bottom: 5rem;
}
</style>
