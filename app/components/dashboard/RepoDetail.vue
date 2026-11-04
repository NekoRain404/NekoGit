<!-- Repo Detail — Full repository detail view (overview, branch info, file tree, local actions). -->
<script setup lang="ts">
import {
  ArchiveIcon,
  BookmarkIcon,
  EyeIcon,
  ExternalLinkIcon,
  FileTextIcon,
  GlobeIcon,
  GitForkIcon,
  GithubIcon,
  InfoIcon,
  Loader2Icon,
  MessageSquareIcon,
  PlusIcon,
  SettingsIcon,
  StarIcon,
  XIcon,
} from 'lucide-vue-next';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import type { LocationQueryRaw } from 'vue-router';

import DiscussionCreateModal from '~/components/dashboard/discussion/DiscussionCreateModal.vue';
import IssueCreateModal from '~/components/dashboard/issue/IssueCreateModal.vue';
import LocalRepositoryPanel from '~/components/dashboard/repo/LocalRepositoryPanel.vue';
import RepositorySettingsModal from '~/components/dashboard/repo/RepositorySettingsModal.vue';
import getFetchErrorMessage from '~/utils/getFetchErrorMessage';

const props = defineProps<{
  repository: any;
  owner: string;
  repo: string;
}>();

const emit = defineEmits<{
  (e: 'repository-updated', repository: Record<string, unknown>): void;
  (e: 'repository-deleted'): void;
  (e: 'repository-transferred', owner: string): void;
}>();

/** Repo Detail Icon. */
type RepoDetailIcon = typeof GithubIcon;

const { locale, t } = useI18n();
const localePath = useLocalePath();
const apiFetch = useNekoGitApiFetch();
const router = useRouter();
const { navigateToDiscussion, navigateToFile, navigateToIssue } = useNavigationHistory();
const {
  branches,
  currentBranch,
  defaultBranch,
  directoryContents,
  loading: loadingFiles,
  error: filesError,
  navigateToBranch,
} = useRepoFiles({
  explicitTarget: () => ({ owner: props.owner, repo: props.repo }),
});

/** License Info. */
interface LicenseInfo {
  name: string | null;
  spdxId: string | null;
  url: string | null;
  path: string | null;
}

/** About Item. */
interface AboutItem {
  label: string;
  value: string;
  href?: string;
  to?: string;
  icon: RepoDetailIcon;
  onClick?: () => void;
}

const copy = computed(() => {
  if (locale.value.startsWith('zh')) {
    return {
      about: '关于',
      archived: '已归档',
      branch: '默认分支',
      created: '创建',
      fork: '衍生',
      forks: '分叉',
      homepage: '主页',
      issues: '开放问题',
      language: '语言',
      license: '许可证',
      adoptLocal: '使用已有本地克隆',
      adoptingLocal: '正在关联本地克隆…',
      clone: '克隆',
      copied: '已复制',
      copyCloneUrl: '复制 Clone URL',
      gitAhead: '领先',
      gitBehind: '落后',
      gitBranch: '分支',
      gitBranchesUnavailable: '无法读取分支',
      gitChanged: '有改动',
      gitChangedFiles: '改动文件',
      gitClean: '干净',
      gitAmend: '修正上次提交',
      gitAmending: '修正中',
      gitCommit: '提交',
      gitCommitChanges: '提交变更',
      gitCommitMessage: '提交说明',
      gitCommitting: '提交中',
      gitConflicted: '冲突',
      gitConflictActionUnavailable: '请先解决冲突，再暂存或取消暂存此文件',
      gitCommits: '提交记录',
      gitCheckoutRemoteBranch: '检出远程',
      gitCheckingOutRemoteBranch: '检出中',
      gitCopied: '复制',
      gitCreateBranch: '创建分支',
      gitCreatingBranch: '创建中',
      gitDeleteBranch: '删除分支',
      gitDeleted: '删除',
      gitDeletingBranch: '删除中',
      gitAbortRebase: '中止变基',
      gitAbortingRebase: '中止中',
      gitRebase: '变基',
      gitRebasing: '变基中',
      gitDiff: 'Diff',
      gitDiffEmpty: '这个文件当前没有可显示的文本 diff',
      gitDiffTruncated: 'diff 已截断',
      gitLastCommit: '最近提交',
      gitUndoLastCommit: '撤销上次提交',
      gitUndoingCommit: '撤销中',
      gitModified: '修改',
      gitRenamed: '重命名',
      gitSelectBranchToDelete: '选择要删除的分支',
      gitSwitchBranch: '切换分支',
      gitSwitchingBranch: '切换中',
      gitFetch: '拉取远端',
      gitFetching: '拉取中',
      gitPull: '快进更新',
      gitPulling: '更新中',
      gitPublishBranch: '发布分支',
      gitPush: '推送',
      gitPushing: '推送中',
      gitStaged: '暂存',
      gitStage: '暂存',
      gitStaging: '暂存中',
      gitStash: '贮藏改动',
      gitStashes: '贮藏',
      gitStashesUnavailable: '无法读取贮藏',
      gitStashing: '贮藏中',
      gitPopStash: '弹出',
      gitPoppingStash: '弹出中',
      gitApplyStash: '应用',
      gitApplyingStash: '应用中',
      gitClearStashes: '清空全部',
      gitClearingStashes: '清空中',
      gitUnstaged: '未暂存',
      gitUnstage: '取消暂存',
      gitUnstaging: '取消暂存中',
      gitUntracked: '未跟踪',
      localChecking: '检查中',
      localChangesUnavailable: '无法读取改动文件',
      localDiffUnavailable: '无法读取 diff',
      localGitUnavailable: '无法读取 Git 状态',
      localHistoryUnavailable: '无法读取提交记录',
      localMissing: '未克隆',
      localRepository: '本地仓库',
      localReady: '已在本机',
      openTerminal: '打开终端',
      openFile: '打开文件',
      noDescription: '这个仓库暂无描述',
      notWatching: '不关注',
      openGitHub: '在 GitHub 查看',
      openLocal: '打开本地',
      private: '私有',
      public: '公开',
      pushed: '最近推送',
      readme: 'README',
      repository: '仓库',
      source: '链接',
      star: 'Star',
      starCount: 'Stars',
      starred: '已 Star',
      stats: '统计',
      unstar: 'Unstar',
      updated: '更新',
      watchAll: '关注所有',
      watchIgnore: '忽略',
      watchNone: '仅被@时',
      watching: '关注',
      watchers: '关注者',
      createPullRequest: '创建 Pull Request',
      createPullRequestHeadBranch: '源分支',
      createPullRequestBaseBranch: '目标分支',
      createPullRequestTitle: 'PR 标题',
      createPullRequestDescription: '描述',
      createPullRequestTitlePlaceholder: 'PR 标题',
      createPullRequestDescriptionPlaceholder: 'PR 描述（可选）',
      confirmAmend: '将暂存改动合并到上一次提交并重写该提交？',
      confirmCommit: '确认提交当前所有改动？',
      confirmUndoCommit: '撤销上一次本地提交？改动会保留在暂存区；若提交已推送，本地与远端将分叉。',
      gitCancelOperation: '取消操作',
      confirmAbortRebase: '确认中止当前变基？本地分支将恢复到变基之前的状态。',
      confirmRebase: '确认将本地提交变基到上游分支？此操作会重写本地提交历史。',
      confirmClearStashes: '确认清空所有贮藏？此操作无法撤销。',
      confirmDeleteBranch: '确认删除这个本地分支？',
      confirmPush: '确认推送到远程仓库？',
      creatingPullRequest: '创建中',
      cancel: '取消',
      pullRequestCreated: 'Pull Request 已创建',
      noPullRequest: '无关联 PR',
      pullRequestN: 'PR #{number}',
      checkoutPR: '检出到本地',
      checkingOutPR: '检出中',
      cloneFirst: '请先克隆仓库',
      prAlreadyExists: '已有关联 PR',
    };
  }

  return {
    about: 'About',
    archived: 'Archived',
    branch: 'Default branch',
    created: 'Created',
    fork: 'Fork',
    forks: 'Forks',
    homepage: 'Homepage',
    issues: 'Open issues',
    language: 'Language',
    license: 'License',
    adoptLocal: 'Use existing local clone',
    adoptingLocal: 'Adopting local clone…',
    clone: 'Clone',
    copied: 'Copied',
    copyCloneUrl: 'Copy clone URL',
    gitAhead: 'Ahead',
    gitBehind: 'Behind',
    gitBranch: 'Branch',
    gitBranchesUnavailable: 'Branches unavailable',
    gitChanged: 'Changed',
    gitChangedFiles: 'Changed files',
    gitClean: 'Clean',
    gitAmend: 'Amend last commit',
    gitAmending: 'Amending',
    gitCommit: 'Commit',
    gitCommitChanges: 'Commit changes',
    gitCommitMessage: 'Commit message',
    gitCommitting: 'Committing',
    gitConflicted: 'Conflicts',
    gitConflictActionUnavailable: 'Resolve conflicts before staging or unstaging this file.',
    gitCommits: 'Commits',
    gitCheckoutRemoteBranch: 'Checkout remote',
    gitCheckingOutRemoteBranch: 'Checking out',
    gitCopied: 'Copied',
    gitCreateBranch: 'Create branch',
    gitCreatingBranch: 'Creating',
    gitDeleteBranch: 'Delete branch',
    gitDeleted: 'Deleted',
    gitDeletingBranch: 'Deleting',
    gitAbortRebase: 'Abort rebase',
    gitAbortingRebase: 'Aborting',
    gitRebase: 'Rebase',
    gitRebasing: 'Rebasing',
    gitDiff: 'Diff',
    gitDiffEmpty: 'No displayable text diff for this file',
    gitDiffTruncated: 'Diff truncated',
    gitLastCommit: 'Last commit',
    gitUndoLastCommit: 'Undo last commit',
    gitUndoingCommit: 'Undoing',
    gitModified: 'Modified',
    gitRenamed: 'Renamed',
    gitSelectBranchToDelete: 'Select branch to delete',
    gitSwitchBranch: 'Switch branch',
    gitSwitchingBranch: 'Switching',
    gitFetch: 'Fetch',
    gitFetching: 'Fetching',
    gitPull: 'Pull',
    gitPulling: 'Pulling',
    gitPublishBranch: 'Publish branch',
    gitPush: 'Push',
    gitPushing: 'Pushing',
    gitStaged: 'Staged',
    gitStage: 'Stage',
    gitStaging: 'Staging',
    gitStash: 'Stash changes',
    gitStashes: 'Stashes',
    gitStashesUnavailable: 'Stashes unavailable',
    gitStashing: 'Stashing',
    gitPopStash: 'Pop',
    gitPoppingStash: 'Popping',
    gitApplyStash: 'Apply',
    gitApplyingStash: 'Applying',
    gitClearStashes: 'Clear all',
    gitClearingStashes: 'Clearing',
    gitUnstaged: 'Unstaged',
    gitUnstage: 'Unstage',
    gitUnstaging: 'Unstaging',
    gitUntracked: 'Untracked',
    localChecking: 'Checking',
    localChangesUnavailable: 'Changed files unavailable',
    localDiffUnavailable: 'Diff unavailable',
    localGitUnavailable: 'Git status unavailable',
    localHistoryUnavailable: 'Commit history unavailable',
    localMissing: 'Not cloned',
    localRepository: 'Local repository',
    localReady: 'On disk',
    openTerminal: 'Open terminal',
    openFile: 'Open file',
    noDescription: 'No description provided',
    notWatching: 'Ignore',
    openGitHub: 'View on GitHub',
    openLocal: 'Open local',
    private: 'Private',
    public: 'Public',
    pushed: 'Pushed',
    readme: 'README',
    repository: 'Repository',
    source: 'Links',
    star: 'Star',
    starCount: 'Stars',
    starred: 'Starred',
    stats: 'Stats',
    unstar: 'Unstar',
    updated: 'Updated',
    watchAll: 'All',
    watchIgnore: 'Ignore',
    watchNone: 'Default',
    watching: 'Watching',
    watchers: 'Watchers',
    createPullRequest: 'Create Pull Request',
    createPullRequestHeadBranch: 'Head branch',
    createPullRequestBaseBranch: 'Base branch',
    createPullRequestTitle: 'PR title',
    createPullRequestDescription: 'Description',
    createPullRequestTitlePlaceholder: 'PR title',
    createPullRequestDescriptionPlaceholder: 'PR description (optional)',
    confirmAmend: 'Add staged changes to the last commit and rewrite it?',
    confirmCommit: 'Commit all current changes?',
    confirmUndoCommit:
      'Undo the last local commit? Changes stay staged. If the commit was pushed, local and remote will diverge.',
    gitCancelOperation: 'Cancel operation',
    confirmAbortRebase: 'Abort the current rebase? The branch returns to its pre-rebase state.',
    confirmRebase:
      'Rebase local commits onto the upstream branch? This rewrites local commit history.',
    confirmClearStashes: 'Clear all stashes? This cannot be undone.',
    confirmDeleteBranch: 'Delete this local branch?',
    confirmPush: 'Push to the remote repository?',
    creatingPullRequest: 'Creating',
    cancel: 'Cancel',
    pullRequestCreated: 'Pull Request created',
    noPullRequest: 'No PR',
    pullRequestN: 'PR #{number}',
    checkoutPR: 'Checkout locally',
    checkingOutPR: 'Checking out',
    cloneFirst: 'Clone the repository first',
    prAlreadyExists: 'PR exists',
  };
});

const localeCode = computed(() => locale.value);
const relativeTimeNow = useRelativeTimeNow();

const isStarred = ref(false);
const loadingStar = ref(false);
const starCount = ref(props.repository.stargazers_count ?? 0);

/** Watch State. */
type WatchState = 'all' | 'default' | 'ignore';
const watchState = ref<WatchState | null>(null);
const isIssueCreateModalOpen = ref(false);
const creatingIssue = ref(false);
const issueCreateError = ref('');
const isDiscussionCreateModalOpen = ref(false);
const isRepositorySettingsOpen = ref(false);
const canManageRepository = ref(false);
const creatingDiscussion = ref(false);
const discussionCreateError = ref('');
const loadingWatch = ref(false);
const showWatchDropdown = ref(false);
const watchCount = ref(props.repository.watchers_count ?? 0);

const readmeContent = ref<string | null>(null);
const readmePath = ref<string | null>(null);
const loadingReadme = ref(false);
const readmeError = ref('');
const readmeRequestId = ref(0);

const licenseInfo = ref<LicenseInfo | null>(null);
const loadingLicense = ref(false);
const licenseRequestId = ref(0);
const languageColor = computed(() => getLanguageColor(props.repository.language));
const repoDefaultBranch = computed(
  () => defaultBranch.value || props.repository.default_branch || ''
);
const repoCurrentBranch = computed(() => currentBranch.value || repoDefaultBranch.value);
const canonicalBranch = computed(() => repoCurrentBranch.value || undefined);
const currentBranchQueryValue = computed(() => {
  return repoCurrentBranch.value && repoCurrentBranch.value !== repoDefaultBranch.value
    ? repoCurrentBranch.value
    : undefined;
});

const visibility = computed(() =>
  props.repository.private ? copy.value.private : copy.value.public
);

const repoBadges = computed(() => {
  const badges: { icon: RepoDetailIcon; label: string; tone: string }[] = [
    {
      icon: GithubIcon,
      label: visibility.value,
      tone: props.repository.private ? 'muted' : 'neutral',
    },
  ];

  if (props.repository.fork) {
    badges.push({ icon: GitForkIcon, label: copy.value.fork, tone: 'neutral' });
  }

  if (props.repository.archived) {
    badges.push({ icon: ArchiveIcon, label: copy.value.archived, tone: 'muted' });
  }

  return badges;
});

const watchStateLabel = computed(() => {
  if (watchState.value === 'all') return copy.value.watching;
  if (watchState.value === 'ignore') return copy.value.notWatching;
  return copy.value.watchNone;
});

const isSubscribedWatchState = (state: WatchState | null) => state === 'all' || state === 'ignore';

const buildRepoFileQuery = (path: string): LocationQueryRaw => ({
  repo: `${props.owner}/${props.repo}`,
  path,
  branch: currentBranchQueryValue.value,
});

const buildRepoFileTo = (path: string) => {
  return localePath({
    path: '/dashboard',
    query: buildRepoFileQuery(path),
  });
};

const trackFileNavigation = (path: string) => {
  navigateToFile(props.owner, props.repo, path, canonicalBranch.value);
};

const aboutItems = computed(() => {
  const items: AboutItem[] = [];

  if (props.repository.homepage) {
    const url = props.repository.homepage.startsWith('http')
      ? props.repository.homepage
      : `https://${props.repository.homepage}`;
    items.push({
      label: copy.value.homepage,
      value: props.repository.homepage,
      href: url,
      icon: GlobeIcon,
    });
  }

  if (licenseInfo.value?.name && licenseInfo.value.path) {
    const licensePath = licenseInfo.value.path;
    items.push({
      label: copy.value.license,
      value: licenseInfo.value.name,
      to: buildRepoFileTo(licensePath),
      icon: FileTextIcon,
      onClick: () => trackFileNavigation(licensePath),
    });
  }

  items.push({
    label: copy.value.branch,
    value: props.repository.default_branch || '-',
    icon: GitForkIcon,
  });

  items.push({
    label: copy.value.created,
    value: formatDate(props.repository.created_at),
    icon: BookmarkIcon,
  });

  items.push({
    label: copy.value.updated,
    value: formatDate(props.repository.updated_at),
    icon: BookmarkIcon,
  });

  return items;
});

const stats = computed(() => [
  { label: copy.value.starCount, value: starCount.value, icon: StarIcon, color: '#f59e0b' },
  { label: copy.value.watchers, value: watchCount.value, icon: EyeIcon, color: '#3b82f6' },
  {
    label: copy.value.forks,
    value: props.repository.forks_count ?? 0,
    icon: GitForkIcon,
    color: '#10b981',
  },
  {
    label: copy.value.issues,
    value: props.repository.open_issues_count ?? 0,
    icon: InfoIcon,
    color: '#8b5cf6',
  },
]);

const formatDate = (value?: string | null) => {
  if (!value) return '-';
  return formatDurationFromNow(value, localeCode.value, relativeTimeNow.value);
};

const toggleStar = async () => {
  if (loadingStar.value) return;
  loadingStar.value = true;

  const previousState = isStarred.value;
  const previousCount = starCount.value;

  try {
    if (isStarred.value) {
      isStarred.value = false;
      starCount.value = Math.max(0, starCount.value - 1);
      await apiFetch(`/api/repos/${props.owner}/${props.repo}/star`, { method: 'DELETE' });
    } else {
      isStarred.value = true;
      starCount.value = starCount.value + 1;
      await apiFetch(`/api/repos/${props.owner}/${props.repo}/star`, { method: 'PUT' });
    }
  } catch {
    isStarred.value = previousState;
    starCount.value = previousCount;
  } finally {
    loadingStar.value = false;
  }
};

const setWatchState = async (state: WatchState) => {
  if (loadingWatch.value) return;
  loadingWatch.value = true;
  showWatchDropdown.value = false;

  const previousState = watchState.value;
  const previousSubscribed = isSubscribedWatchState(previousState);

  try {
    if (state === 'default') {
      await apiFetch(`/api/repos/${props.owner}/${props.repo}/subscription`, { method: 'DELETE' });
    } else {
      await apiFetch(`/api/repos/${props.owner}/${props.repo}/subscription`, {
        method: 'PUT',
        body: { subscribed: state === 'all', ignored: state === 'ignore' },
      });
    }

    watchState.value = state;

    const nextSubscribed = isSubscribedWatchState(state);
    if (previousSubscribed !== nextSubscribed) {
      watchCount.value = previousSubscribed
        ? Math.max(0, watchCount.value - 1)
        : watchCount.value + 1;
    }
  } catch {
    watchState.value = previousState;
  } finally {
    loadingWatch.value = false;
  }
};

const toggleWatchDropdown = () => {
  showWatchDropdown.value = !showWatchDropdown.value;
};

const closeWatchDropdown = () => {
  showWatchDropdown.value = false;
};

const fetchStarState = async () => {
  try {
    const data = await apiFetch<{ starred: boolean }>(
      `/api/repos/${props.owner}/${props.repo}/star`
    );
    isStarred.value = data.starred;
  } catch {
    // Silently fail - default to unstarred
  }
};

const fetchWatchState = async () => {
  try {
    const data = await apiFetch<{ subscribed: boolean; ignored: boolean }>(
      `/api/repos/${props.owner}/${props.repo}/subscription`
    );
    if (data.subscribed) {
      watchState.value = 'all';
    } else if (data.ignored) {
      watchState.value = 'ignore';
    } else {
      watchState.value = 'default';
    }
  } catch {
    watchState.value = 'default';
  }
};

const buildRefQuery = () => {
  const branch = currentBranchQueryValue.value;
  return branch ? `?ref=${encodeURIComponent(branch)}` : '';
};

const fetchReadme = async () => {
  const requestId = readmeRequestId.value + 1;
  readmeRequestId.value = requestId;
  loadingReadme.value = true;
  readmeError.value = '';
  try {
    const data = await apiFetch<{ content: string | null; path?: string | null }>(
      `/api/repos/${props.owner}/${props.repo}/readme${buildRefQuery()}`
    );
    if (requestId !== readmeRequestId.value) return;

    readmeContent.value = data.content;
    readmePath.value = data.path ?? null;
    if (!data.content) {
      readmeError.value = t('repoDetail.readmeMissing');
    }
  } catch (error: unknown) {
    if (requestId === readmeRequestId.value) {
      readmeContent.value = null;
      readmePath.value = null;
      readmeError.value =
        error instanceof Error && error.message ? error.message : t('repoDetail.readmeLoadFailed');
    }
  } finally {
    if (requestId === readmeRequestId.value) {
      loadingReadme.value = false;
    }
  }
};

const fetchLicense = async () => {
  const requestId = licenseRequestId.value + 1;
  licenseRequestId.value = requestId;
  licenseInfo.value = null;
  loadingLicense.value = true;
  try {
    const data = await apiFetch<LicenseInfo>(
      `/api/repos/${props.owner}/${props.repo}/license${buildRefQuery()}`
    );
    if (requestId !== licenseRequestId.value) return;

    licenseInfo.value = data;
  } catch {
    if (requestId === licenseRequestId.value) {
      licenseInfo.value = null;
    }
  } finally {
    if (requestId === licenseRequestId.value) {
      loadingLicense.value = false;
    }
  }
};

const openDiscussionCreateModal = () => {
  discussionCreateError.value = '';
  isDiscussionCreateModalOpen.value = true;
};

const closeDiscussionCreateModal = () => {
  if (creatingDiscussion.value) return;
  isDiscussionCreateModalOpen.value = false;
  discussionCreateError.value = '';
};

const createDiscussion = async (payload: { title: string; body: string; categoryId: string }) => {
  if (creatingDiscussion.value) return;

  creatingDiscussion.value = true;
  discussionCreateError.value = '';
  try {
    const response = await apiFetch<{ discussion?: { number?: number } }>(
      `/api/repos/${props.owner}/${props.repo}/discussions`,
      {
        method: 'POST',
        body: payload,
      }
    );
    const number = response?.discussion?.number;

    if (typeof number !== 'number') {
      throw new Error(t('discussionDetail.createDiscussionFailed'));
    }

    isDiscussionCreateModalOpen.value = false;
    navigateToDiscussion(props.owner, props.repo, number);
    await router.push(
      localePath({
        path: '/dashboard',
        query: {
          tab: 'issues',
          discussion: `${props.owner}/${props.repo}/${number}`,
        },
      })
    );
  } catch (error: unknown) {
    discussionCreateError.value = getFetchErrorMessage(
      error,
      t('discussionDetail.createDiscussionFailed')
    );
  } finally {
    creatingDiscussion.value = false;
  }
};

const openIssueCreateModal = () => {
  issueCreateError.value = '';
  isIssueCreateModalOpen.value = true;
};

const closeIssueCreateModal = () => {
  if (creatingIssue.value) return;
  isIssueCreateModalOpen.value = false;
  issueCreateError.value = '';
};

const createIssue = async (payload: { title: string; body: string }) => {
  if (creatingIssue.value) return;

  creatingIssue.value = true;
  issueCreateError.value = '';
  try {
    const issue = await apiFetch<{ number?: number }>(
      `/api/repos/${props.owner}/${props.repo}/issues`,
      {
        method: 'POST',
        body: { title: payload.title, body: payload.body },
      }
    );

    if (typeof issue?.number !== 'number') {
      throw new Error(t('issueDetail.createIssueFailed'));
    }

    isIssueCreateModalOpen.value = false;
    navigateToIssue(props.owner, props.repo, issue.number);
    await router.push(
      localePath({
        path: '/dashboard',
        query: {
          tab: 'issues',
          issue: `${props.owner}/${props.repo}/${issue.number}`,
        },
      })
    );
  } catch (error: unknown) {
    issueCreateError.value = getFetchErrorMessage(error, t('issueDetail.createIssueFailed'));
  } finally {
    creatingIssue.value = false;
  }
};

const fetchRepositoryPermissions = async () => {
  try {
    const permissions = await apiFetch<{ admin?: boolean }>(
      `/api/repos/${props.owner}/${props.repo}/permissions`
    );
    canManageRepository.value = Boolean(permissions?.admin);
  } catch {
    canManageRepository.value = false;
  }
};

const openRepositorySettings = () => {
  isRepositorySettingsOpen.value = true;
};

const closeRepositorySettings = () => {
  isRepositorySettingsOpen.value = false;
};

const handleRepositoryUpdated = (updated: Record<string, unknown>) => {
  emit('repository-updated', updated);
};

const handleRepositoryDeleted = () => {
  isRepositorySettingsOpen.value = false;
  emit('repository-deleted');
};

const handleRepositoryTransferred = (newOwner: string) => {
  isRepositorySettingsOpen.value = false;
  emit('repository-transferred', newOwner);
};

onMounted(() => {
  fetchStarState();
  fetchWatchState();
  void fetchRepositoryPermissions();
});

watch(
  () => [props.owner, props.repo, repoCurrentBranch.value],
  () => {
    if (!repoCurrentBranch.value) return;

    fetchReadme();
    fetchLicense();
  },
  { immediate: true }
);

// Close dropdown on outside click
const handleClickOutside = (e: MouseEvent) => {
  const target = e.target;
  if (!(target instanceof Element) || !target.closest('.watch-dropdown-wrapper')) {
    closeWatchDropdown();
  }
};

onMounted(() => document.addEventListener('click', handleClickOutside));
onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>

<template>
  <div class="repo-detail-layout">
    <div class="columns">
      <div class="column detail-main-column">
        <section class="repo-detail-header">
          <div class="repo-detail-header__title-row">
            <GithubIcon :size="28" class="repo-detail-header__icon" />
            <h1 class="title is-3 repo-detail-header__title">{{ repository.name }}</h1>
            <div class="repo-detail-header__actions">
              <button
                class="repo-action-btn"
                :class="{ 'repo-action-btn--active': isStarred }"
                :disabled="loadingStar"
                @click="toggleStar"
              >
                <Loader2Icon v-if="loadingStar" :size="14" class="spin-animation" />
                <StarIcon v-else :size="14" :fill="isStarred ? 'currentColor' : 'none'" />
                <span>{{ isStarred ? copy.starred : copy.star }}</span>
              </button>

              <div class="watch-dropdown-wrapper">
                <button
                  class="repo-action-btn"
                  :class="{ 'repo-action-btn--active': watchState === 'all' }"
                  :disabled="loadingWatch"
                  @click.stop="toggleWatchDropdown"
                >
                  <Loader2Icon v-if="loadingWatch" :size="14" class="spin-animation" />
                  <EyeIcon v-else :size="14" />
                  <span>{{ watchStateLabel }}</span>
                </button>
                <div v-if="showWatchDropdown" class="watch-dropdown">
                  <button
                    class="watch-dropdown__item"
                    :class="{ 'watch-dropdown__item--active': watchState === 'all' }"
                    @click="setWatchState('all')"
                  >
                    <EyeIcon :size="14" />
                    <div class="watch-dropdown__item-content">
                      <span class="watch-dropdown__item-label">{{ copy.watchAll }}</span>
                      <span class="watch-dropdown__item-desc">
                        {{ t('repoDetail.watchAllDescription') }}
                      </span>
                    </div>
                  </button>
                  <button
                    class="watch-dropdown__item"
                    :class="{ 'watch-dropdown__item--active': watchState === 'default' }"
                    @click="setWatchState('default')"
                  >
                    <EyeIcon :size="14" />
                    <div class="watch-dropdown__item-content">
                      <span class="watch-dropdown__item-label">{{ copy.watchNone }}</span>
                      <span class="watch-dropdown__item-desc">
                        {{ t('repoDetail.watchDefaultDescription') }}
                      </span>
                    </div>
                  </button>
                  <button
                    class="watch-dropdown__item"
                    :class="{ 'watch-dropdown__item--active': watchState === 'ignore' }"
                    @click="setWatchState('ignore')"
                  >
                    <XIcon :size="14" />
                    <div class="watch-dropdown__item-content">
                      <span class="watch-dropdown__item-label">{{ copy.watchIgnore }}</span>
                      <span class="watch-dropdown__item-desc">
                        {{ t('repoDetail.watchIgnoreDescription') }}
                      </span>
                    </div>
                  </button>
                </div>
              </div>

              <button
                v-if="canManageRepository"
                class="repo-action-btn"
                type="button"
                @click="openRepositorySettings"
              >
                <SettingsIcon :size="14" />
                <span>{{ t('repoSettings.open') }}</span>
              </button>

              <button
                class="repo-action-btn"
                type="button"
                :disabled="creatingIssue"
                @click="openIssueCreateModal"
              >
                <Loader2Icon v-if="creatingIssue" :size="14" class="spin-animation" />
                <PlusIcon v-else :size="14" />
                <span>{{ t('issueDetail.newIssue') }}</span>
              </button>

              <button
                class="repo-action-btn"
                type="button"
                :disabled="creatingDiscussion"
                @click="openDiscussionCreateModal"
              >
                <Loader2Icon v-if="creatingDiscussion" :size="14" class="spin-animation" />
                <MessageSquareIcon v-else :size="14" />
                <span>{{ t('discussionDetail.newDiscussion') }}</span>
              </button>

              <BranchSelector
                :branches="branches"
                :current-branch="repoCurrentBranch"
                :default-branch="repoDefaultBranch"
                :loading="loadingFiles"
                @select="navigateToBranch"
              />
            </div>
          </div>

          <div class="repo-detail-header__meta">
            <span class="tag mr-2 repo-detail-header__type">{{ copy.repository }}</span>
            <span class="subtitle mb-0 is-6 has-text-weight-medium">{{ owner }}/{{ repo }}</span>
            <span
              v-if="repository.language"
              class="tag is-link is-light ml-3 repo-detail-header__language"
            >
              <span
                class="repo-detail-header__language-dot"
                :style="{ backgroundColor: languageColor }"
              />
              <span>{{ repository.language }}</span>
            </span>
            <span
              v-for="badge in repoBadges"
              :key="badge.label"
              class="tag ml-2 repo-detail-header__badge"
            >
              <component :is="badge.icon" :size="13" />
              <span>{{ badge.label }}</span>
            </span>
          </div>

          <div v-if="repository.description" class="repo-detail-description mb-4">
            <p class="repo-detail-description__body">
              {{ repository.description }}
            </p>
          </div>

          <div class="repo-about mb-4">
            <div class="repo-about__grid">
              <div v-for="item in aboutItems" :key="item.label" class="repo-about__item">
                <component :is="item.icon" :size="14" class="repo-about__item-icon" />
                <span class="repo-about__item-label">{{ item.label }}:</span>
                <NuxtLinkLocale
                  v-if="item.to"
                  :to="item.to"
                  class="repo-about__item-value repo-about__item-value--link"
                  @click="item.onClick?.()"
                >
                  {{ item.value }}
                </NuxtLinkLocale>
                <a
                  v-else-if="item.href"
                  :href="item.href"
                  target="_blank"
                  rel="noopener noreferrer"
                  data-nekogit-external
                  class="repo-about__item-value repo-about__item-value--link"
                >
                  {{ item.value }}
                  <ExternalLinkIcon :size="10" />
                </a>
                <span v-else class="repo-about__item-value">{{ item.value }}</span>
              </div>
            </div>
          </div>

          <hr class="mr-4" />

          <RepoFileTree
            :owner="owner"
            :repo="repo"
            :items="directoryContents"
            :loading="loadingFiles"
            :error="filesError"
            :current-branch="repoCurrentBranch"
            :default-branch="repoDefaultBranch"
          />

          <div class="repo-readme">
            <h2 class="title is-5 repo-readme__title">
              <BookmarkIcon :size="18" />
              <span>{{ copy.readme }}</span>
            </h2>
            <div v-if="loadingReadme" class="repo-readme__loading">
              <Loader2Icon :size="20" class="spin-animation" />
            </div>
            <div v-else-if="readmeError" class="repo-readme__error">
              {{ readmeError }}
            </div>
            <div v-else-if="readmeContent" class="repo-readme__content content">
              <MarkdownRenderer
                :value="readmeContent"
                :repo-owner="owner"
                :repo-name="repo"
                :base-path="readmePath ?? undefined"
                :branch="repoCurrentBranch || undefined"
              />
            </div>
            <div v-else class="repo-readme__empty">
              {{ t('repoDetail.readmeMissing') }}
            </div>
          </div>
        </section>
      </div>

      <div class="column detail-sidebar-column">
        <div class="sidebar-scroll">
          <div class="sidebar-card mb-4">
            <div class="sidebar-card__header">
              <div class="sidebar-card__header-left">
                <StarIcon :size="14" class="sidebar-card__icon" />
                <span class="sidebar-card__title">{{ copy.stats }}</span>
              </div>
            </div>
            <div class="sidebar-card__content">
              <div class="info-stats">
                <div v-for="stat in stats" :key="stat.label" class="info-stat">
                  <component
                    :is="stat.icon"
                    :size="20"
                    class="info-stat__icon"
                    :style="{ color: stat.color }"
                  />
                  <span class="info-stat__value">{{ stat.value }}</span>
                  <span class="info-stat__label">{{ stat.label }}</span>
                </div>
              </div>
            </div>
          </div>

          <LocalRepositoryPanel
            :owner="owner"
            :repo="repo"
            :fallback-branch="repoCurrentBranch"
            :copy="copy"
            :format-date="formatDate"
          />

          <div class="sidebar-card">
            <div class="sidebar-card__header">
              <div class="sidebar-card__header-left">
                <ExternalLinkIcon :size="14" class="sidebar-card__icon" />
                <span class="sidebar-card__title">{{ copy.source }}</span>
              </div>
            </div>
            <div class="sidebar-card__content">
              <a
                :href="repository.html_url"
                target="_blank"
                rel="noopener noreferrer"
                data-nekogit-external
                class="sidebar-link"
              >
                <ExternalLinkIcon :size="14" />
                <span>{{ copy.openGitHub }}</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <IssueCreateModal
    :is-visible="isIssueCreateModalOpen"
    :loading="creatingIssue"
    :error="issueCreateError"
    @close="closeIssueCreateModal"
    @save="createIssue"
  />

  <DiscussionCreateModal
    :is-visible="isDiscussionCreateModalOpen"
    :owner="owner"
    :repo="repo"
    :loading="creatingDiscussion"
    :error="discussionCreateError"
    @close="closeDiscussionCreateModal"
    @save="createDiscussion"
  />

  <RepositorySettingsModal
    v-if="canManageRepository"
    :is-visible="isRepositorySettingsOpen"
    :owner="owner"
    :repo="repo"
    :repository="repository"
    @close="closeRepositorySettings"
    @updated="handleRepositoryUpdated"
    @deleted="handleRepositoryDeleted"
    @transferred="handleRepositoryTransferred"
  />
</template>

<style scoped lang="scss">
@use '~/assets/scss/_variables' as *;

.repo-detail-layout {
  height: 100%;
  min-height: 0;
}

.repo-detail-layout :deep(.columns) {
  height: 100%;
  min-height: 0;
  align-items: stretch;
  margin-bottom: 0;
}

.repo-detail-layout :deep(.detail-main-column) {
  height: 100%;
  min-height: 0;
  overflow-y: auto;
  flex: none;
  width: 72%;
}

.repo-detail-layout :deep(.detail-sidebar-column) {
  height: 100%;
  min-height: 0;
  overflow: hidden;
  flex: none;
  width: 28%;
  padding-right: 1rem;
}

.repo-detail-header {
  max-width: 68rem;
  padding: 0.75rem 1rem 5rem 0;
}

.repo-detail-header__title-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

.repo-detail-header__icon {
  flex: 0 0 auto;
  color: var(--nekogit-success);
}

.repo-detail-header__title {
  margin-bottom: 0;
  overflow-wrap: anywhere;
  letter-spacing: 0;
}

.repo-detail-header__actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-left: auto;
}

.repo-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid var(--nekogit-border);
  border-radius: 6px;
  background: var(--nekogit-surface);
  color: var(--nekogit-text-muted);
  font-size: 12px;
  font-weight: 500;
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

  &--active {
    background: var(--nekogit-surface-active);
    border-color: var(--nekogit-accent);
    color: var(--nekogit-accent);

    &:hover:not(:disabled) {
      background: var(--nekogit-surface-active);
    }
  }
}

.watch-dropdown-wrapper {
  position: relative;
}

.watch-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  z-index: 100;
  min-width: 200px;
  margin-top: 4px;
  border: 1px solid var(--nekogit-border);
  border-radius: 8px;
  background: var(--nekogit-surface);
  box-shadow: var(--nekogit-shadow-raised);
}

.watch-dropdown__item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  border: none;
  background: transparent;
  color: var(--nekogit-text-muted);
  font-size: 12px;
  text-align: left;
  cursor: pointer;
  transition: background 0.1s ease;

  &:hover {
    background: var(--nekogit-surface-hover);
  }

  &--active {
    background: var(--nekogit-surface-active);
    color: var(--nekogit-accent);
  }

  &:first-child {
    border-radius: 8px 8px 0 0;
  }

  &:last-child {
    border-radius: 0 0 8px 8px;
  }
}

.watch-dropdown__item-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.watch-dropdown__item-label {
  font-weight: 600;
}

.watch-dropdown__item-desc {
  color: var(--nekogit-text-muted);
  font-size: 11px;
}

.repo-detail-header__meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-bottom: 1rem;
}

.repo-detail-header__type {
  background-color: var(--nekogit-surface-muted);
  color: var(--nekogit-text-strong);
}

.repo-detail-header__language,
.repo-detail-header__badge {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-weight: 600;
}

.repo-detail-header__language-dot {
  width: 0.6rem;
  height: 0.6rem;
  border-radius: 999px;
}

.repo-detail-description {
  max-width: 54rem;
}

.repo-detail-description__body {
  margin-bottom: 0;
  color: var(--bulma-text-strong);
  font-size: 1rem;
  line-height: 1.6;
}

.repo-about {
  margin-bottom: 1rem;
}

.repo-about__grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1.5rem;
}

.repo-about__item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}

.repo-about__item-icon {
  color: var(--nekogit-text-muted);
  flex-shrink: 0;
}

.repo-about__item-label {
  color: var(--nekogit-text-muted);
  font-weight: 500;
}

.repo-about__item-value {
  color: var(--bulma-text-strong, var(--nekogit-text-strong));
}

.repo-about__item-value--link {
  color: var(--nekogit-link);
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
}

.repo-readme {
  margin-top: 1.5rem;
}

.repo-readme__title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 1rem;
  color: var(--bulma-text-strong, var(--nekogit-text-strong));
  font-size: 1.125rem;
}

.repo-readme__loading {
  display: flex;
  justify-content: center;
  padding: 3rem;
  color: var(--nekogit-text-muted);
}

.repo-readme__content {
  // Let MarkdownRenderer handle its own styles
}

.repo-readme__error {
  margin: 0.75rem 0;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  background: var(--nekogit-danger-soft);
  color: var(--nekogit-danger);
  font-size: 0.85rem;
}

.repo-readme__empty {
  padding: 2rem;
  color: var(--nekogit-text-muted);
  font-size: 13px;
  text-align: center;
}

.sidebar-scroll {
  height: 100%;
  overflow-y: auto;
  padding-right: 0.75rem;
  scrollbar-gutter: stable;
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;

  &:hover {
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
  }

  &:hover::-webkit-scrollbar-thumb {
    background-color: var(--nekogit-scrollbar-thumb);
  }
}

.sidebar-card {
  overflow: hidden;
  border: 1px solid var(--nekogit-border);
  border-radius: 8px;
  background: var(--nekogit-surface-muted);
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
  color: var(--bulma-text-strong, var(--nekogit-text-strong));
  font-size: 13px;
  font-weight: 600;
}

.sidebar-card__content {
  padding: 12px 16px;
}

.info-stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.info-stat {
  display: flex;
  align-items: center;
  flex-direction: column;
  justify-content: center;
  min-height: 5.5rem;
  padding: 0.75rem;
  border: 1px solid var(--nekogit-border);
  border-radius: 8px;
  background: var(--nekogit-surface);
  transition: all 0.2s ease;

  &:hover {
    border-color: var(--nekogit-border-strong);
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  }
}

.info-stat__icon {
  margin-bottom: 0.5rem;
  transition: transform 0.2s ease;

  .info-stat:hover & {
    transform: scale(1.1);
  }
}

.info-stat__value {
  margin-bottom: 0.25rem;
  color: var(--bulma-text-strong, var(--nekogit-text-strong));
  font-size: 1.35rem;
  font-weight: 800;
}

.info-stat__label {
  color: var(--nekogit-text-muted);
  font-size: 12px;
  text-align: center;
}

.sidebar-link {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--nekogit-border);
  border-radius: 8px;
  background: var(--nekogit-surface);
  color: var(--nekogit-text-muted);
  font-size: 12px;
  font-weight: 500;
  text-decoration: none;
  transition: all 0.12s ease;

  &:hover,
  &:focus-visible {
    border-color: var(--nekogit-border-strong);
    background: var(--nekogit-surface-hover);
    color: var(--bulma-text-strong, var(--nekogit-text-strong));
  }

  &:disabled {
    opacity: 0.5;
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

@media screen and (max-width: 1024px) {
  .repo-detail-layout :deep(.columns) {
    display: block;
    height: auto;
  }

  .repo-detail-layout :deep(.detail-main-column),
  .repo-detail-layout :deep(.detail-sidebar-column) {
    height: auto;
    overflow: visible;
  }

  .repo-detail-header {
    padding-right: 0;
    padding-bottom: 2rem;
  }

  .repo-detail-header__title-row {
    flex-wrap: wrap;
  }

  .repo-detail-header__actions {
    width: 100%;
    margin-top: 0.5rem;
    margin-left: 0;
  }
}
</style>
