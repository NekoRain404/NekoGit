# CI Checks Integration 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 PR 详情中集成 GitHub Actions / Checks API，显示检查状态、重跑失败任务、查看日志。

**Architecture:** 新增 2 个服务端 API（`GET checks` 获取 check runs、`POST rerun` 重跑检查）；新增前端 `PRChecksPanel` 侧栏组件展示 CI 状态；在 `PRDetail.vue` 侧栏集成。

**Tech Stack:** Nuxt 4 / Nitro (server), Vue 3 + TypeScript (frontend)

## Global Constraints

- 遵循现有 API 模式：`definePrivateApiCoalescedEventHandler` 或 `defineEventHandler` + `executeGitHubRequest`
- 前端 API 调用使用 `useNekoGitApiFetch()` 的 `apiFetch` 函数（自动 CSRF 处理）
- i18n 同时更新 `en.json` 和 `zh-cn.json`
- 侧栏卡片遵循 `.sidebar-card` CSS 类模式（见 `PRActions.vue` / `PRLabels.vue`）
- 图标使用 `lucide-vue-next`
- 日志通过 GitHub 链接在新标签页打开，不实现内联日志查看
- 完成后运行 `pnpm test && pnpm typecheck && pnpm lint`

---

### Task 1: 服务端 API — `GET /api/repos/[owner]/[repo]/pulls/[pull_number]/checks` (获取 check runs)

**Files:**
- Create: `server/api/repos/[owner]/[repo]/pulls/[pull_number]/checks.get.ts`

**Interfaces:**
- Consumes: `extractPullRouteParams(event)` → `{ owner, repo, pullNumber }`, `getGitHubSessionContext(event)` → `{ octokit, userLogin }`
- Produces: `GET /api/repos/:owner/:repo/pulls/:pull_number/checks` endpoint, returns `{ check_runs: CheckRun[], total_count: number, combined_status: { state: string, statuses: any[] } }`

- [ ] **Step 1: Create the endpoint file**

```typescript
// server/api/repos/[owner]/[repo]/pulls/[pull_number]/checks.get.ts
import { extractPullRouteParams } from '#server/utils/repo-route-utils';

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

interface ChecksApiResponse {
  check_runs: CheckRun[];
  total_count: number;
  combined_status: {
    state: string;
    statuses: Array<{ context: string; state: string; description: string }>;
  };
}

export default definePrivateApiCoalescedEventHandler(async (event) => {
  try {
    const { owner, repo, pullNumber } = extractPullRouteParams(event);
    const { octokit } = await getGitHubSessionContext(event);

    // Get the PR to find the head commit SHA
    const { data: pullRequest } = await octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}', {
      owner,
      repo,
      pull_number: pullNumber,
    });

    const headSha = pullRequest.head?.sha;
    if (!headSha) {
      return {
        check_runs: [],
        total_count: 0,
        combined_status: { state: 'pending', statuses: [] },
      } satisfies ChecksApiResponse;
    }

    // Fetch check runs for the head commit
    const { data: checkRunsData } = await octokit.request('GET /repos/{owner}/{repo}/commits/{ref}/check-runs', {
      owner,
      repo,
      ref: headSha,
      per_page: 100,
    });

    // Fetch combined status for the head commit
    const { data: combinedStatusData } = await octokit.request('GET /repos/{owner}/{repo}/commits/{ref}/status', {
      owner,
      repo,
      ref: headSha,
    });

    return {
      check_runs: checkRunsData.check_runs as CheckRun[],
      total_count: checkRunsData.total_count,
      combined_status: {
        state: combinedStatusData.state,
        statuses: combinedStatusData.statuses,
      },
    } satisfies ChecksApiResponse;
  } catch (error: unknown) {
    console.error('Error fetching pull request checks:', error);
    throwGitHubRouteError(error, 'Failed to fetch pull request checks');
  }
});
```

- [ ] **Step 2: Verify compilation**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add server/api/repos/\[owner\]/\[repo\]/pulls/\[pull_number\]/checks.get.ts
git commit -m "feat(api): add GET /repos/:owner/:repo/pulls/:pull_number/checks endpoint"
```

---

### Task 2: 服务端 API — `POST /api/repos/[owner]/[repo]/pulls/[pull_number]/checks/[run_id]/rerun` (重跑 check run)

**Files:**
- Create: `server/api/repos/[owner]/[repo]/pulls/[pull_number]/checks/[run_id]/rerun.post.ts`

**Interfaces:**
- Consumes: `extractRepoParams(event)`, `extractPullNumber(event)` (or inline extraction), `executeGitHubRequest(event, fn, errorMsg)`
- Produces: `POST /api/repos/:owner/:repo/pulls/:pull_number/checks/:run_id/rerun` endpoint, returns updated check run

- [ ] **Step 1: Create the endpoint file**

```typescript
// server/api/repos/[owner]/[repo]/pulls/[pull_number]/checks/[run_id]/rerun.post.ts
import { extractRepoParams, extractPullNumber, executeGitHubRequest } from '#server/utils/repo-route-utils';

export default defineEventHandler(async (event) => {
  const { owner, repo } = extractRepoParams(event);
  const pullNumber = extractPullNumber(event);
  const { run_id } = event.context.params as { run_id: string };
  const runId = Number(run_id);

  if (!Number.isInteger(runId) || runId < 1) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid check run ID',
    });
  }

  return executeGitHubRequest(
    event,
    async (octokit) => {
      const { data: checkRun } = await octokit.request('POST /repos/{owner}/{repo}/check-runs/{run_id}/rerun', {
        owner,
        repo,
        run_id: runId,
      });
      return checkRun;
    },
    'Failed to rerun check run'
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
git add server/api/repos/\[owner\]/\[repo\]/pulls/\[pull_number\]/checks/\[run_id\]/rerun.post.ts
git commit -m "feat(api): add POST /repos/:owner/:repo/pulls/:pull_number/checks/:run_id/rerun endpoint"
```

---

### Task 3: 前端 — CI 状态面板组件 (PRChecksPanel.vue)

**Files:**
- Create: `app/components/dashboard/pr/PRChecksPanel.vue`
- Modify: `app/components/dashboard/PRDetail.vue` (集成到侧栏)

**Interfaces:**
- Consumes: `owner`, `repo`, `pullNumber` props, `apiFetch` from `useNekoGitApiFetch()`
- Produces: 侧栏卡片展示 check runs 摘要与列表，含总览行、各 check run 状态图标与名称

- [ ] **Step 1: Create the PRChecksPanel component**

```vue
<!-- PRChecksPanel — NekoGit dashboard component. -->
<script setup lang="ts">
import { AlertCircleIcon, CheckCircleIcon, ClockIcon, ExternalLinkIcon, Loader2Icon, PlayIcon, XCircleIcon } from 'lucide-vue-next';
import { computed, onMounted, ref, watch } from 'vue';
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

interface CombinedStatus {
  state: string;
  statuses: Array<{ context: string; state: string; description: string }>;
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

const summary = computed(() => {
  const total = checkRuns.value.length;
  const passing = checkRuns.value.filter(
    (r) => r.status === 'completed' && r.conclusion === 'success'
  ).length;
  const failing = checkRuns.value.filter(
    (r) => r.status === 'completed' && r.conclusion && r.conclusion !== 'success'
  ).length;
  const pending = checkRuns.value.filter(
    (r) => r.status !== 'completed'
  ).length;
  return { total, passing, failing, pending };
});

const getCheckIcon = (run: CheckRun) => {
  if (run.status !== 'completed') return ClockIcon;
  if (run.conclusion === 'success') return CheckCircleIcon;
  if (run.conclusion === 'failure' || run.conclusion === 'timed_out' || run.conclusion === 'cancelled') return XCircleIcon;
  if (run.conclusion === 'skipped' || run.conclusion === 'neutral') return AlertCircleIcon;
  return ClockIcon;
};

const getCheckIconClass = (run: CheckRun) => {
  if (run.status !== 'completed') return 'check-icon--pending';
  if (run.conclusion === 'success') return 'check-icon--success';
  if (run.conclusion === 'failure' || run.conclusion === 'timed_out' || run.conclusion === 'cancelled') return 'check-icon--failure';
  if (run.conclusion === 'skipped' || run.conclusion === 'neutral') return 'check-icon--skipped';
  return 'check-icon--pending';
};

const getConclusionLabel = (run: CheckRun) => {
  if (run.status !== 'completed') return run.status === 'queued' ? t('prReview.ciChecks.queued') : t('prReview.ciChecks.inProgress');
  if (run.conclusion === 'success') return t('prReview.ciChecks.passed');
  if (run.conclusion === 'failure') return t('prReview.ciChecks.failed');
  if (run.conclusion === 'timed_out') return t('prReview.ciChecks.timedOut');
  if (run.conclusion === 'cancelled') return t('prReview.ciChecks.cancelled');
  if (run.conclusion === 'skipped') return t('prReview.ciChecks.skipped');
  if (run.conclusion === 'neutral') return t('prReview.ciChecks.neutral');
  return run.conclusion || '';
};

const canRerun = (run: CheckRun) => {
  return run.status === 'completed' && run.conclusion && run.conclusion !== 'success' && run.conclusion !== 'skipped' && run.conclusion !== 'neutral';
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

const fetchChecks = async () => {
  if (!props.owner || !props.repo || !props.pullNumber) return;

  loading.value = true;
  error.value = '';

  try {
    const data = await apiFetch<ChecksResponse>(
      `/api/repos/${props.owner}/${props.repo}/pulls/${props.pullNumber}/checks`,
      { method: 'GET' }
    );
    checkRuns.value = data?.check_runs || [];
  } catch (err: unknown) {
    console.error('Error fetching PR checks:', err);
    error.value = getFetchErrorMessage(err, t('prReview.ciChecks.failedToLoad'));
    checkRuns.value = [];
  } finally {
    loading.value = false;
  }
};

watch(
  () => [props.owner, props.repo, props.pullNumber] as const,
  () => {
    fetchChecks();
  },
  { immediate: true }
);
</script>

<template>
  <div class="sidebar-card mt-4">
    <div class="sidebar-card__header">
      <div class="sidebar-card__header-left">
        <PlayIcon :size="14" class="sidebar-card__icon" />
        <span class="sidebar-card__title">{{ t('prReview.ciChecks.checks') }}</span>
      </div>
      <div v-if="!loading" class="sidebar-card__header-actions">
        <span class="sidebar-badge">{{ summary.total }}</span>
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

      <div v-else-if="checkRuns.length === 0" class="sidebar-card__empty">
        {{ t('prReview.ciChecks.noChecks') }}
      </div>

      <template v-else>
        <div class="checks-summary">
          <span v-if="summary.passing > 0" class="checks-summary__item checks-summary__item--pass">
            {{ summary.passing }} {{ t('prReview.ciChecks.passing') }}
          </span>
          <span v-if="summary.failing > 0" class="checks-summary__item checks-summary__item--fail">
            {{ summary.failing }} {{ t('prReview.ciChecks.failing') }}
          </span>
          <span v-if="summary.pending > 0" class="checks-summary__item checks-summary__item--pending">
            {{ summary.pending }} {{ t('prReview.ciChecks.pending') }}
          </span>
        </div>

        <div class="checks-list">
          <div
            v-for="run in checkRuns"
            :key="run.id"
            class="check-item"
          >
            <div class="check-item__icon">
              <component
                :is="getCheckIcon(run)"
                :size="14"
                :class="getCheckIconClass(run)"
              />
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
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
```

- [ ] **Step 2: Integrate PRChecksPanel into PRDetail.vue sidebar**

In `PRDetail.vue`, add the import and the component in the sidebar. Insert between `PRActions` and the Open Review button section.

Add import (after line 138 `import PRReviewWorkspace...`):

```typescript
import PRChecksPanel from '~/components/dashboard/pr/PRChecksPanel.vue';
```

Add in the template sidebar, after `PRActions` block (after `</PRActions>` closing tag, around line 79) and before `PRReviewerRequestModal` (line 81):

```vue
          <PRChecksPanel
            :owner="repoOwner"
            :repo="repoName"
            :pull-number="currentPullRequest?.number || 0"
          />
```

- [ ] **Step 3: Verify compilation**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/components/dashboard/pr/PRChecksPanel.vue app/components/dashboard/PRDetail.vue
git commit -m "feat: add PRChecksPanel component with CI status display"
```

---

### Task 4: 前端 — 重跑 + 日志按钮 (集成在 PRChecksPanel 中)

> Note: The rerun button and view logs link are already implemented in `PRChecksPanel.vue` in Task 3. This task verifies the integration works correctly.

**Files:**
- Already created: `app/components/dashboard/pr/PRChecksPanel.vue`

**Interfaces:**
- Consumes: Existing `rerunCheck` method in `PRChecksPanel.vue` calls `POST /api/repos/:owner/:repo/pulls/:pull_number/checks/:run_id/rerun`
- Produces: Rerun button on failed check runs, view logs link on all check runs

- [ ] **Step 1: Verify rerun flow**

The `rerunCheck` method in `PRChecksPanel.vue` calls `POST /checks/:run_id/rerun` and on success refreshes the checks list via `fetchChecks()`. Verify the `RotateCcwIcon` import is present:

```typescript
import { RotateCcwIcon } from 'lucide-vue-next';
```

Add `RotateCcwIcon` to the import list in `PRChecksPanel.vue` (line 1 currently imports `AlertCircleIcon, CheckCircleIcon, ClockIcon, ExternalLinkIcon, Loader2Icon, PlayIcon, XCircleIcon` — add `RotateCcwIcon`):

```typescript
import { AlertCircleIcon, CheckCircleIcon, ClockIcon, ExternalLinkIcon, Loader2Icon, PlayIcon, RotateCcwIcon, XCircleIcon } from 'lucide-vue-next';
```

- [ ] **Step 2: Verify compilation**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/components/dashboard/pr/PRChecksPanel.vue
git commit -m "feat: add rerun and view logs buttons to PRChecksPanel"
```

---

### Task 5: 国际化 — 更新 i18n 文件

**Files:**
- Modify: `i18n/locales/en.json`
- Modify: `i18n/locales/zh-cn.json`

- [ ] **Step 1: Add en keys**

In `i18n/locales/en.json`, add under `prReview` (after `cloneFirst` at line 742):

```json
    "ciChecks": {
      "checks": "Checks",
      "passing": "passing",
      "failing": "failing",
      "pending": "pending",
      "noChecks": "No checks found",
      "loading": "Loading checks...",
      "failedToLoad": "Failed to load checks",
      "rerun": "Rerun",
      "rerunning": "Rerunning...",
      "viewLogs": "View logs",
      "rerunFailed": "Failed to rerun check",
      "queued": "Queued",
      "inProgress": "In progress",
      "passed": "Passed",
      "failed": "Failed",
      "timedOut": "Timed out",
      "cancelled": "Cancelled",
      "skipped": "Skipped",
      "neutral": "Neutral"
    }
```

- [ ] **Step 2: Add zh-cn keys**

In `i18n/locales/zh-cn.json`, add under `prReview` (after `cloneFirst` at line 742):

```json
    "ciChecks": {
      "checks": "检查",
      "passing": "通过",
      "failing": "失败",
      "pending": "待处理",
      "noChecks": "没有检查项",
      "loading": "加载检查中...",
      "failedToLoad": "加载检查失败",
      "rerun": "重跑",
      "rerunning": "重跑中...",
      "viewLogs": "查看日志",
      "rerunFailed": "重跑检查失败",
      "queued": "排队中",
      "inProgress": "进行中",
      "passed": "通过",
      "failed": "失败",
      "timedOut": "超时",
      "cancelled": "已取消",
      "skipped": "已跳过",
      "neutral": "中性"
    }
```

- [ ] **Step 3: Commit**

```bash
git add i18n/locales/en.json i18n/locales/zh-cn.json
git commit -m "i18n: add CI checks translations"
```

---

### Task 6: 验证

**Files:** None (run verification commands)

- [ ] **Step 1: Run all tests**

```bash
pnpm test
```

Expected: all tests pass (no existing tests should break).

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
git commit -m "chore: fix lint/type issues after CI checks integration implementation"
```