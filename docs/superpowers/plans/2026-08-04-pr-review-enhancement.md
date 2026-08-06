# PR Review 体验增强 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 增强 PR Code Review 体验：提交级导航、快捷操作（approve/merge/close）、diff 上下文展开。

**Architecture:** 新增 1 个服务端 API（`PATCH pulls` 更新/合并 PR）；增强前端 `PRHeader.vue` 添加快捷操作按钮；`PRReviewWorkspace.vue` 增加 commit 选择器切换 diff；`PRReviewDiffViewer.vue` 增加 hunk 上下文展开功能。

**Tech Stack:** Nuxt 4 / Nitro (server), Vue 3 + TypeScript (frontend), `useI18n` for i18n

## Global Constraints

- 遵循现有 API 模式：`defineEventHandler` + `extractPullRouteParams` + `executeGitHubRequest` (POST/PATCH) 或 `definePrivateApiCoalescedEventHandler` (GET)
- 前端 API 调用使用 `useNekoGitApiFetch()` 的 `apiFetch` 函数（自动 CSRF 处理）或 `$fetch` 直接调用
- i18n 同时更新 `en.json` 和 `zh-cn.json`
- 无新增 Rust 代码
- 完成后运行 `pnpm test && pnpm typecheck && pnpm lint`

---

### Task 1: 服务端 API — `PATCH /api/repos/[owner]/[repo]/pulls/[pull_number]` (更新/合并 PR)

**Files:**
- Create: `server/api/repos/[owner]/[repo]/pulls/[pull_number].patch.ts`

**Interfaces:**
- Consumes: `extractPullRouteParams(event)`, `readBody<UpdatePullRequestBody>(event)`, `executeGitHubRequest(event, fn, errorMsg)`
- Produces: `PATCH /api/repos/:owner/:repo/pulls/:pull_number` endpoint, returns updated GitHub pull request object

- [ ] **Step 1: Create the endpoint file**

```typescript
// server/api/repos/[owner]/[repo]/pulls/[pull_number].patch.ts
import { extractPullRouteParams, executeGitHubRequest } from '#server/utils/repo-route-utils';

interface UpdatePullRequestBody {
  state?: 'closed' | 'open';
  merge?: boolean;
  merge_method?: 'merge' | 'squash' | 'rebase';
}

export default defineEventHandler(async (event) => {
  const { owner, repo, pullNumber } = extractPullRouteParams(event);
  const body = await readBody<UpdatePullRequestBody>(event);

  if (!body || (!body.state && !body.merge)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'state or merge is required',
    });
  }

  return executeGitHubRequest(
    event,
    async (octokit) => {
      if (body.merge) {
        const { data: pr } = await octokit.request(
          'PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge',
          {
            owner,
            repo,
            pull_number: pullNumber,
            merge_method: body.merge_method ?? 'merge',
          }
        );
        return pr;
      }

      const { data: pr } = await octokit.request(
        'PATCH /repos/{owner}/{repo}/pulls/{pull_number}',
        {
          owner,
          repo,
          pull_number: pullNumber,
          state: body.state,
        }
      );
      return pr;
    },
    'Failed to update pull request'
  );
});
```

- [ ] **Step 2: Verify compilation**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add server/api/repos/[owner]/[repo]/pulls/[pull_number].patch.ts
git commit -m "feat(api): add PATCH /repos/:owner/:repo/pulls/:pull_number endpoint"
```

---

### Task 2: 前端 — PRHeader 快捷操作 (approve/merge/close)

**Files:**
- Modify: `app/components/dashboard/pr/PRHeader.vue`

**Interfaces:**
- Consumes: new props `owner`, `repo`, `pullNumber`, `commitId`, `mergeable: boolean`, `canMerge: boolean`, `prState: string`
- Emits: `approve`, `request-changes`, `merge`, `close-pr`, `reopen-pr`
- Produces: action button bar in PRHeader

- [ ] **Step 1: Add new props and emit definitions**

Add after existing `defineProps<{ pullRequest?, repoOwner, repoName }>()`:

```typescript
const props = defineProps<{
  pullRequest?: PullRequestHeaderPullRequest | null;
  repoOwner: string;
  repoName: string;
  pullNumber: number;
  commitId: string;
  mergeable?: boolean | null;
  canMerge?: boolean;
}>();

const emit = defineEmits<{
  (e: 'approve'): void;
  (e: 'request-changes'): void;
  (e: 'merge'): void;
  (e: 'close-pr'): void;
  (e: 'reopen-pr'): void;
}>();
```

- [ ] **Step 2: Add action buttons to template**

Add after the `</div>` closing the author block (around line 78) and before the `<hr />`:

```vue
<div class="pr-header__actions mb-4">
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
      v-if="canMerge && mergeable !== false"
      class="button is-small is-info is-light mr-2"
      type="button"
      @click="emit('merge')"
    >
      <GitMergeIcon :size="14" class="mr-1" />
      {{ t('prReview.mergePr') }}
    </button>
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
    v-else
    class="button is-small is-success is-light"
    type="button"
    @click="emit('reopen-pr')"
  >
    <GitPullRequestIcon :size="14" class="mr-1" />
    {{ t('prReview.reopenPr') }}
  </button>
</div>
```

- [ ] **Step 3: Add icon imports**

Add to the existing import block:

```typescript
import { CheckIcon, XCircleIcon } from 'lucide-vue-next';
```

- [ ] **Step 4: Add styles**

```scss
.pr-header__actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.25rem;
}
```

- [ ] **Step 5: Verify compilation**

```bash
pnpm typecheck
```

- [ ] **Step 6: Commit**

```bash
git add app/components/dashboard/pr/PRHeader.vue
git commit -m "feat: add approve/merge/close action buttons to PRHeader"
```

---

### Task 3: 前端 — PRDetail 连接 PRHeader 快捷操作到 API

**Files:**
- Modify: `app/components/dashboard/PRDetail.vue`

**Interfaces:**
- Consumes: `apiFetch` from `useNekoGitApiFetch()`, `currentPullRequest`, `reviewCommitId`, `repoOwner`, `repoName`
- Produces: Action handlers for approve/merge/close/reopen, wired to PRHeader emit events

- [ ] **Step 1: Add action handler methods**

In `PRDetail.vue`, add after `checkoutPullRequestLocally` (around line 290):

```typescript
const prActionLoading = shallowRef(false);

const getPrIdentity = () => {
  if (!repoOwner.value || !repoName.value || !currentPullRequest.value?.number) return null;
  return { owner: repoOwner.value, repo: repoName.value, pullNumber: currentPullRequest.value.number };
};

const handleApprove = async () => {
  const identity = getPrIdentity();
  const commitId = reviewCommitId.value;
  if (!identity || !commitId) return;
  prActionLoading.value = true;
  try {
    await apiFetch(
      `/api/repos/${identity.owner}/${identity.repo}/pulls/${identity.pullNumber}/reviews`,
      { method: 'POST', body: { commitId, event: 'APPROVE', body: '' } }
    );
  } catch (err: unknown) {
    detailError.value = getFetchErrorMessage(err, 'Failed to approve pull request.');
  } finally {
    prActionLoading.value = false;
  }
};

const handleRequestChanges = async () => {
  const identity = getPrIdentity();
  const commitId = reviewCommitId.value;
  if (!identity || !commitId) return;
  prActionLoading.value = true;
  try {
    await apiFetch(
      `/api/repos/${identity.owner}/${identity.repo}/pulls/${identity.pullNumber}/reviews`,
      { method: 'POST', body: { commitId, event: 'REQUEST_CHANGES', body: '' } }
    );
  } catch (err: unknown) {
    detailError.value = getFetchErrorMessage(err, 'Failed to request changes.');
  } finally {
    prActionLoading.value = false;
  }
};

const handleMerge = async () => {
  const identity = getPrIdentity();
  if (!identity) return;
  prActionLoading.value = true;
  try {
    const result = await apiFetch(
      `/api/repos/${identity.owner}/${identity.repo}/pulls/${identity.pullNumber}`,
      { method: 'PATCH', body: { merge: true, merge_method: 'squash' } }
    );
    currentPullRequest.value = { ...currentPullRequest.value, ...(result as Record<string, unknown>) };
  } catch (err: unknown) {
    detailError.value = getFetchErrorMessage(err, 'Failed to merge pull request.');
  } finally {
    prActionLoading.value = false;
  }
};

const handleClosePr = async () => {
  const identity = getPrIdentity();
  if (!identity) return;
  prActionLoading.value = true;
  try {
    const result = await apiFetch(
      `/api/repos/${identity.owner}/${identity.repo}/pulls/${identity.pullNumber}`,
      { method: 'PATCH', body: { state: 'closed' } }
    );
    currentPullRequest.value = { ...currentPullRequest.value, ...(result as Record<string, unknown>) };
  } catch (err: unknown) {
    detailError.value = getFetchErrorMessage(err, 'Failed to close pull request.');
  } finally {
    prActionLoading.value = false;
  }
};

const handleReopenPr = async () => {
  const identity = getPrIdentity();
  if (!identity) return;
  prActionLoading.value = true;
  try {
    const result = await apiFetch(
      `/api/repos/${identity.owner}/${identity.repo}/pulls/${identity.pullNumber}`,
      { method: 'PATCH', body: { state: 'open' } }
    );
    currentPullRequest.value = { ...currentPullRequest.value, ...(result as Record<string, unknown>) };
  } catch (err: unknown) {
    detailError.value = getFetchErrorMessage(err, 'Failed to reopen pull request.');
  } finally {
    prActionLoading.value = false;
  }
};
```

- [ ] **Step 2: Pass new props to PRHeader and wire events**

Update the `<PRHeader>` usage in template:

```vue
<PRHeader
  :pull-request="currentPullRequest"
  :repo-owner="repoOwner"
  :repo-name="repoName"
  :pull-number="currentPullRequest?.number || 0"
  :commit-id="reviewCommitId"
  :mergeable="currentPullRequest?.mergeable"
  :can-merge="currentPullRequest?.state === 'open' && !currentPullRequest?.merged_at"
  @approve="handleApprove"
  @request-changes="handleRequestChanges"
  @merge="handleMerge"
  @close-pr="handleClosePr"
  @reopen-pr="handleReopenPr"
/>
```

- [ ] **Step 3: Verify compilation**

```bash
pnpm typecheck
```

- [ ] **Step 4: Commit**

```bash
git add app/components/dashboard/PRDetail.vue
git commit -m "feat: wire PR header action buttons to API calls"
```

---

### Task 4: 前端 — PRReviewWorkspace 提交级导航

**Files:**
- Modify: `app/composables/usePRReview.ts` (add `commitSha` parameter to `loadFiles`)
- Create: `app/components/dashboard/pr/PRReviewCommitSelector.vue` (new component)
- Modify: `app/components/dashboard/pr/PRReviewWorkspace.vue` (add commit selector to header)

**Interfaces:**
- Consumes: `usePRReview` extended with `commitSha` parameter; timeline API for commits list
- Produces: Commit selector dropdown in workspace header

- [ ] **Step 1: Extend `usePRReview` to accept optional `commitSha`**

In `app/composables/usePRReview.ts`, add `commitSha` to the identity and pass it to the files API:

Add `commitSha` to `UsePRReviewOptions`:

```typescript
interface UsePRReviewOptions {
  owner: () => string;
  repo: () => string;
  pullNumber: () => number;
  commitId: () => string;
  commitSha?: () => string | undefined; // NEW
  messages: {
    loadFailed: string;
    submitFailed: string;
    resolveThreadFailed: string;
    unresolveThreadFailed: string;
  };
  onSubmitted?: () => void;
}
```

Add `commitSha` to the identity computed:

```typescript
const identity = computed(() => ({
  owner: options.owner(),
  repo: options.repo(),
  pullNumber: options.pullNumber(),
  commitId: options.commitId(),
  commitSha: options.commitSha?.() ?? undefined,
}));
```

Update `loadFiles` to pass `sha` as a query parameter:

```typescript
const [response, reviewCommentResponse] = await Promise.all([
  $fetch<PullFilesResponse>(`/api/pulls/${owner}/${repo}/${pullNumber}/files`, {
    method: 'GET',
    query: {
      page,
      per_page: 100,
      ...(identity.value.commitSha ? { sha: identity.value.commitSha } : {}),
    },
  }),
  isFirstPage ? fetchReviewComments() : Promise.resolve(null),
]);
```

Add `commitSha` to the watch identity dependencies:

```typescript
watch(
  () => [
    identity.value.owner,
    identity.value.repo,
    identity.value.pullNumber,
    identity.value.commitId,
    identity.value.commitSha,
  ],
  () => {
    requestId.value += 1;
    resetFiles();
    resetDrafts();
    loadFiles(1);
  },
  { immediate: true }
);
```

- [ ] **Step 2: Create PRReviewCommitSelector component**

```vue
<!-- PRReview Commit Selector — NekoGit dashboard component. -->
<script setup lang="ts">
import { ChevronDownIcon } from 'lucide-vue-next';
import { computed, shallowRef, watch } from 'vue';

const { t } = useI18n();

interface CommitItem {
  sha: string;
  shortSha: string;
  message: string;
  authorName: string;
  date: string;
}

const props = defineProps<{
  commits: CommitItem[];
  selectedSha: string;
  loading: boolean;
}>();

const emit = defineEmits<{
  (e: 'select', sha: string): void;
}>();

const isOpen = shallowRef(false);

const selectedCommit = computed(() =>
  props.commits.find((c) => c.sha === props.selectedSha) ?? props.commits[0] ?? null
);

const handleSelect = (sha: string) => {
  isOpen.value = false;
  if (sha !== props.selectedSha) {
    emit('select', sha);
  }
};

watch(() => props.selectedSha, () => {
  isOpen.value = false;
});
</script>

<template>
  <div class="pr-review-commit-selector">
    <button
      class="pr-review-commit-selector__trigger"
      type="button"
      :disabled="loading || !commits.length"
      @click="isOpen = !isOpen"
    >
      <span v-if="loading" class="pr-review-commit-selector__loading">
        {{ t('prReview.loadingCommits') }}
      </span>
      <template v-else-if="selectedCommit">
        <span class="pr-review-commit-selector__sha">{{ selectedCommit.shortSha }}</span>
        <span class="pr-review-commit-selector__message">{{ selectedCommit.message }}</span>
        <span class="pr-review-commit-selector__author">{{ selectedCommit.authorName }}</span>
      </template>
      <span v-else class="pr-review-commit-selector__placeholder">
        {{ t('prReview.selectCommit') }}
      </span>
      <ChevronDownIcon :size="14" class="pr-review-commit-selector__chevron" />
    </button>
    <div v-if="isOpen" class="pr-review-commit-selector__dropdown">
      <button
        v-for="commit in commits"
        :key="commit.sha"
        class="pr-review-commit-selector__option"
        :class="{ 'pr-review-commit-selector__option--active': commit.sha === selectedSha }"
        type="button"
        @click="handleSelect(commit.sha)"
      >
        <span class="pr-review-commit-selector__option-sha">{{ commit.shortSha }}</span>
        <span class="pr-review-commit-selector__option-message">{{ commit.message }}</span>
        <span class="pr-review-commit-selector__option-author">{{ commit.authorName }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.pr-review-commit-selector {
  position: relative;
  flex: none;
}

.pr-review-commit-selector__trigger {
  min-height: 1.65rem;
  max-width: 18rem;
  border: 1px solid var(--nekogit-border);
  border-radius: 999px;
  padding: 0.15rem 0.6rem;
  background: var(--nekogit-surface);
  color: var(--nekogit-text-muted);
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  cursor: pointer;
  font-size: 0.72rem;
  font-weight: 600;
  overflow: hidden;

  &:hover:not(:disabled) {
    border-color: var(--nekogit-border-strong);
    color: var(--bulma-text-strong, var(--nekogit-text-strong));
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.pr-review-commit-selector__sha {
  font-family: var(--nekogit-code-font-family);
  color: var(--nekogit-info);
  flex: none;
}

.pr-review-commit-selector__message {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
  text-align: left;
}

.pr-review-commit-selector__author {
  flex: none;
  color: var(--nekogit-text-muted);
  font-size: 0.65rem;
}

.pr-review-commit-selector__chevron {
  flex: none;
  color: var(--nekogit-text-muted);
}

.pr-review-commit-selector__loading {
  color: var(--nekogit-text-muted);
  font-style: italic;
}

.pr-review-commit-selector__placeholder {
  color: var(--nekogit-text-muted);
}

.pr-review-commit-selector__dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 100;
  min-width: 20rem;
  max-height: 16rem;
  overflow-y: auto;
  margin-top: 4px;
  border: 1px solid var(--nekogit-border);
  border-radius: 8px;
  background: var(--nekogit-surface);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.pr-review-commit-selector__option {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border: 0;
  background: transparent;
  color: var(--nekogit-text-strong);
  font-size: 0.75rem;
  text-align: left;
  cursor: pointer;

  &:hover {
    background: var(--nekogit-surface-hover);
  }
}

.pr-review-commit-selector__option--active {
  background: var(--nekogit-info-soft);
  color: var(--nekogit-info);
}

.pr-review-commit-selector__option-sha {
  font-family: var(--nekogit-code-font-family);
  font-size: 0.7rem;
  flex: none;
  color: var(--nekogit-info);
}

.pr-review-commit-selector__option-message {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

.pr-review-commit-selector__option-author {
  flex: none;
  color: var(--nekogit-text-muted);
  font-size: 0.65rem;
}
</style>
```

- [ ] **Step 3: Integrate commit selector into PRReviewWorkspace**

In `PRReviewWorkspace.vue`, add new props and state for commits:

```typescript
const props = defineProps<{
  owner: string;
  repo: string;
  pullNumber: number;
  commitId: string;
  title?: string;
  commits?: Array<{ sha: string; shortSha: string; message: string; authorName: string; date: string }>;
  commitsLoading?: boolean;
}>();
```

Add a new `selectedCommitSha` ref:

```typescript
const selectedCommitSha = shallowRef(props.commitId);
```

Add the watcher to sync when `commitId` prop changes:

```typescript
watch(() => props.commitId, (newCommitId) => {
  selectedCommitSha.value = newCommitId;
});
```

Add the `PRReviewCommitSelector` to the workspace header, after the identity block and before the summary pills:

```vue
<PRReviewCommitSelector
  v-if="commits && commits.length > 1"
  :commits="commits"
  :selected-sha="selectedCommitSha"
  :loading="commitsLoading"
  @select="handleCommitSelect"
/>
```

Add `handleCommitSelect`:

```typescript
const handleCommitSelect = async (sha: string) => {
  selectedCommitSha.value = sha;
  // Re-fetch files for the selected commit SHA
  // The workspace already has a commitSha prop, but we need to update the files
  // We can re-mount the review composable or use a different approach
  // For now, emit an event to the parent to re-create the workspace with the new commitId
  // Actually, the files endpoint accepts a sha query parameter
  // We need to modify the usePRReview composable to accept a commitSha parameter
};
```

Update the `review` composable call to pass `commitSha`:

```typescript
const review = usePRReview({
  owner: () => props.owner,
  repo: () => props.repo,
  pullNumber: () => props.pullNumber,
  commitId: () => props.commitId,
  commitSha: () => selectedCommitSha.value !== props.commitId ? selectedCommitSha.value : undefined,
  messages: {
    loadFailed: t('prReview.loadFailed'),
    submitFailed: t('prReview.submitFailed'),
    resolveThreadFailed: t('prReview.resolveThreadFailed'),
    unresolveThreadFailed: t('prReview.unresolveThreadFailed'),
  },
  onSubmitted: () => emit('close'),
});
```

Import the new component:

```typescript
import PRReviewCommitSelector from '~/components/dashboard/pr/PRReviewCommitSelector.vue';
```

- [ ] **Step 4: Fetch commits from timeline in PRDetail when opening review window**

In `PRDetail.vue`, add state for commits and pass them to `PRReviewWorkspace`:

```typescript
const reviewCommits = shallowRef<Array<{ sha: string; shortSha: string; message: string; authorName: string; date: string }>>([]);
const reviewCommitsLoading = shallowRef(false);

const loadReviewCommits = async () => {
  if (!repoOwner.value || !repoName.value || !currentPullRequest.value?.number) return;
  reviewCommitsLoading.value = true;
  try {
    const data = await apiFetch<{ timeline?: any[] }>(
      `/api/pulls/${repoOwner.value}/${repoName.value}/${currentPullRequest.value.number}/timeline`,
      { method: 'GET', query: { page: 1 } }
    );
    const commits = (data?.timeline ?? [])
      .filter((item: any) => item.kind === 'commit' && item.commit?.oid)
      .map((item: any) => ({
        sha: item.commit.oid,
        shortSha: (item.commit.oid as string).slice(0, 7),
        message: (item.commit.message ?? '').split('\n')[0] || '(no message)',
        authorName: item.commit.author?.name ?? item.author?.login ?? 'Unknown',
        date: item.commit.committedDate ?? item.createdAt ?? '',
      }));
    reviewCommits.value = commits;
  } catch {
    reviewCommits.value = [];
  } finally {
    reviewCommitsLoading.value = false;
  }
};

const openReviewWindow = () => {
  if (!canOpenReviewWindow.value) return;
  isReviewWindowOpen.value = true;
  emit('open-review');
  void loadReviewCommits();
};
```

Pass commits to `PRReviewWorkspace`:

```vue
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
```

- [ ] **Step 5: Update the `/api/pulls/:owner/:repo/:pull_number/files` endpoint to accept `sha` query param**

In `server/api/pulls/[owner]/[repo]/[pull_number]/files.get.ts`, add `sha` to the query and pass it to the GitHub API request:

```typescript
const query = getQuery(event);
const page = parsePaginationNumber(query.page, 1);
const perPage = parsePaginationNumber(query.per_page, 100, 100);
const pullNumber = parsePaginationNumber(pull_number, 0);
const sha = typeof query.sha === 'string' ? query.sha : undefined;

if (!owner || !repo || pullNumber < 1) {
  throw createError({
    statusCode: 400,
    statusMessage: 'Invalid pull request number',
  });
}

const octokit = await getGitHubClient(event);
const { data, headers } = await octokit.request(
  'GET /repos/{owner}/{repo}/pulls/{pull_number}/files',
  {
    owner,
    repo,
    pull_number: pullNumber,
    page,
    per_page: perPage,
    ...(sha ? { sha } : {}),
  }
);
```

- [ ] **Step 6: Verify compilation**

```bash
pnpm typecheck
```

- [ ] **Step 7: Commit**

```bash
git add app/composables/usePRReview.ts app/components/dashboard/pr/PRReviewCommitSelector.vue app/components/dashboard/pr/PRReviewWorkspace.vue app/components/dashboard/PRDetail.vue server/api/pulls/[owner]/[repo]/[pull_number]/files.get.ts
git commit -m "feat: add commit-level navigation in PR review workspace"
```

---

### Task 5: 前端 — Diff 上下文展开

**Files:**
- Modify: `app/components/dashboard/pr/PRReviewDiffViewer.vue` (add expand buttons to hunk headers)
- Modify: `app/components/dashboard/pr/PRReviewVirtualDiffRows.vue` (handle expanded context rows)

**Interfaces:**
- Consumes: `PRReviewDiffRow` with expanded context rows injected before/after hunk header
- Produces: Expand buttons in each hunk header line

- [ ] **Step 1: Add expand button rendering in hunk row template**

In `PRReviewVirtualDiffRows.vue`, find the hunk row rendering (around line 500-550). The hunk row is rendered as a `<tr>` with class `pr-review-virtual-diff-row--hunk`. Add expand buttons after the hunk header content:

In the template, after the hunk header content span, add:

```vue
<span class="pr-review-virtual-diff-row__expand-actions">
  <button
    class="pr-review-virtual-diff-row__expand-btn"
    type="button"
    :title="t('prReview.expandContext', { lines: 3 })"
    @click.stop="expandContext(row, 3)"
  >
    +3
  </button>
  <button
    class="pr-review-virtual-diff-row__expand-btn"
    type="button"
    :title="t('prReview.expandContext', { lines: 5 })"
    @click.stop="expandContext(row, 5)"
  >
    +5
  </button>
  <button
    class="pr-review-virtual-diff-row__expand-btn"
    type="button"
    :title="t('prReview.expandContext', { lines: 10 })"
    @click.stop="expandContext(row, 10)"
  >
    +10
  </button>
</span>
```

- [ ] **Step 2: Add `expandContext` method and state**

```typescript
const expandedHunks = shallowRef(new Map<string, PRReviewDiffRow[]>());

const getExpandedRowsForKey = (hunkKey: string) => expandedHunks.value.get(hunkKey) ?? [];

const expandContext = async (hunkRow: PRReviewDiffRow, linesToAdd: number) => {
  const hunkMatch = hunkRow.content.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
  if (!hunkMatch) return;

  const hunkKey = `${props.filename}:${hunkRow.content}`;
  if (expandedHunks.value.has(hunkKey)) return; // Already expanded

  const oldStart = Number.parseInt(hunkMatch[1] ?? '0', 10);
  const newStart = Number.parseInt(hunkMatch[2] ?? '0', 10);
  const contextStart = Math.max(1, newStart - linesToAdd);
  const contextLines = newStart - contextStart;

  if (contextLines <= 0) return;

  // Fetch file content from the server to get context lines
  try {
    const apiFetch = useNekoGitApiFetch();
    const contents = await apiFetch<{ content?: string }>(
      `/api/repos/${props.repoOwner}/${props.repoName}/contents/${encodeURIComponent(props.filename)}`,
      { method: 'GET', query: { ref: 'HEAD' } }
    );

    if (!contents?.content) return;

    const decoded = atob(contents.content);
    const fileLines = decoded.split('\n');
    const contextRows: PRReviewDiffRow[] = [];

    for (let i = 0; i < contextLines; i += 1) {
      const lineIndex = contextStart - 1 + i;
      const lineNumber = contextStart + i;
      const content = fileLines[lineIndex] ?? '';
      contextRows.push({
        key: `expanded-${lineNumber}-${hunkKey}`,
        type: 'context',
        content,
        oldContent: undefined,
        newContent: undefined,
        oldLineNumber: oldStart - contextLines + i,
        newLineNumber: lineNumber,
        position: null,
        isCommentable: true,
      });
    }

    expandedHunks.value = new Map(expandedHunks.value).set(hunkKey, contextRows);
  } catch {
    // Silently fail — context expansion is non-critical
  }
};
```

- [ ] **Step 3: Inject expanded rows into the rows list**

Modify the `rows` prop processing to inject expanded context rows. In the computed where `visibleRows` is built, after the hunk row, check for expanded rows:

The expanded rows are stored in a separate Map keyed by hunk key. The `PRReviewVirtualDiffRows` component receives `rows` as a prop. We need to create a merged rows array that includes expanded context rows.

Add a computed `mergedRows` that inserts expanded rows after their corresponding hunk rows:

```typescript
const mergedRows = computed(() => {
  const result: PRReviewDiffRow[] = [];
  for (const row of props.rows) {
    result.push(row);
    if (row.type === 'hunk') {
      const hunkKey = `${props.filename}:${row.content}`;
      const expanded = expandedHunks.value.get(hunkKey);
      if (expanded) {
        result.push(...expanded);
      }
    }
  }
  return result;
});
```

Then use `mergedRows` instead of `props.rows` for all row-related computations.

- [ ] **Step 4: Add styles for expand buttons**

```scss
.pr-review-virtual-diff-row__expand-actions {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  margin-left: 8px;
}

.pr-review-virtual-diff-row__expand-btn {
  min-height: 1.2rem;
  padding: 0 4px;
  border: 1px solid var(--nekogit-border);
  border-radius: 3px;
  background: var(--nekogit-surface);
  color: var(--nekogit-text-muted);
  font-size: 0.6rem;
  font-weight: 700;
  cursor: pointer;
  line-height: 1;

  &:hover {
    background: var(--nekogit-surface-hover);
    color: var(--nekogit-info);
    border-color: var(--nekogit-info);
  }
}
```

- [ ] **Step 5: Add `apiFetch` import**

```typescript
const apiFetch = useNekoGitApiFetch();
```

- [ ] **Step 6: Verify compilation**

```bash
pnpm typecheck
```

- [ ] **Step 7: Commit**

```bash
git add app/components/dashboard/pr/PRReviewDiffViewer.vue app/components/dashboard/pr/PRReviewVirtualDiffRows.vue
git commit -m "feat: add diff context expand/collapse buttons in hunk headers"
```

---

### Task 6: i18n — 更新国际化文案

**Files:**
- Modify: `i18n/locales/en.json`
- Modify: `i18n/locales/zh-cn.json`

- [ ] **Step 1: Add en keys under `prReview`**

Add before `checkoutLocally`:

```json
"mergePr": "Merge pull request",
"closePr": "Close pull request",
"reopenPr": "Reopen pull request",
"loadingCommits": "Loading commits...",
"selectCommit": "Select commit",
"expandContext": "Expand {lines} lines",
"commitSelector": "Switch commit"
```

- [ ] **Step 2: Add zh-cn keys under `prReview`**

Add before `checkoutLocally`:

```json
"mergePr": "合并拉取请求",
"closePr": "关闭拉取请求",
"reopenPr": "重新打开拉取请求",
"loadingCommits": "正在加载提交...",
"selectCommit": "选择提交",
"expandContext": "展开 {lines} 行",
"commitSelector": "切换提交"
```

- [ ] **Step 3: Commit**

```bash
git add i18n/locales/en.json i18n/locales/zh-cn.json
git commit -m "i18n: add PR review enhancement translations"
```

---

### Task 7: 验证

**Files:** None (run verification commands)

- [ ] **Step 1: Run all tests**

```bash
pnpm test
```

Expected: all existing tests pass.

- [ ] **Step 2: Type check**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Lint**

```bash
pnpm lint
```

Expected: no errors.

- [ ] **Step 4: Commit any remaining changes**

```bash
git add -A
git commit -m "chore: fix lint/type issues after PR review enhancement implementation"
```