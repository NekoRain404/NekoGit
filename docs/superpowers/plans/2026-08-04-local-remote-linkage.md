# 本地↔远程联动 + 自动化 实现计划

> **Status (2026-11-04):** shipped. Step checkboxes below are retained as the original implementation record; see `docs/audit/2026-11-04-code-audit.md` for follow-up fixes and known gaps.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 打通 NekoGit 本地仓库面板 ↔ GitHub 远程 PR 的双向关联，实现一键开 PR 和桌面端检出 PR 分支。

**Architecture:** 新增 2 个服务端 API（`POST pulls` 创建 PR、`GET pull-for-branch` 查询分支关联 PR）；扩展前端 `useLocalRepositoryPanel` 添加 PR 关联查询和创建 PR 方法；增强 `LocalRepositoryGitSummary` 显示 PR 关联徽章；`LocalRepositoryActions` 增加「Create PR」按钮与表单；`PRDetail` 侧栏增加「Checkout Locally」桌面检出按钮。

**Tech Stack:** Nuxt 4 / Nitro (server), Vue 3 + TypeScript (frontend), Rust/Tauri (desktop commands, no new Rust code needed)

## Global Constraints

- 遵循现有 API 模式：`definePrivateApiCoalescedEventHandler` 或 `defineEventHandler` + `executeGitHubRequest`
- 前端 API 调用使用 `useNekoGitApiFetch()` 的 `apiFetch` 函数（自动 CSRF 处理）
- 桌面命令使用 `useDesktopRuntime()` 中已有的 `checkoutRemoteLocalRepositoryBranch`
- i18n 同时更新 `en.json` 和 `zh-cn.json`
- `LocalRepositoryCopy` 类型定义在 `app/composables/local-repository-panel/types.ts`，copy 实现在 `app/components/dashboard/RepoDetail.vue`
- 无新增 Rust 代码
- 完成后运行 `pnpm test && pnpm typecheck && pnpm lint && cargo check --manifest-path src-tauri/Cargo.toml`

---

### Task 1: 服务端 API — `POST /api/repos/[owner]/[repo]/pulls` (创建 PR)

**Files:**

- Create: `server/api/repos/[owner]/[repo]/pulls.post.ts`

**Interfaces:**

- Consumes: `extractPullRouteParams(event)` → `{ owner, repo, pullNumber }`, `readBody<CreatePullRequestBody>(event)`, `executeGitHubRequest(event, fn, errorMsg)`
- Produces: `POST /api/repos/:owner/:repo/pulls` endpoint, returns GitHub pull request object

- [ ] **Step 1: Create the endpoint file**

```typescript
// server/api/repos/[owner]/[repo]/pulls.post.ts
import { extractRepoParams, executeGitHubRequest } from '#server/utils/repo-route-utils';

interface CreatePullRequestBody {
  head: string;
  base: string;
  title: string;
  body?: string;
}

export default defineEventHandler(async (event) => {
  const { owner, repo } = extractRepoParams(event);
  const body = await readBody<CreatePullRequestBody>(event);

  if (!body?.head || !body?.base || !body?.title) {
    throw createError({ statusCode: 400, statusMessage: 'head, base, and title are required' });
  }

  return executeGitHubRequest(
    event,
    async (octokit) => {
      const { data: pull } = await octokit.request('POST /repos/{owner}/{repo}/pulls', {
        owner,
        repo,
        head: body.head,
        base: body.base,
        title: body.title.trim(),
        body: body.body?.trim() || undefined,
      });
      return pull;
    },
    'Failed to create pull request'
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
git add server/api/repos/[owner]/[repo]/pulls.post.ts
git commit -m "feat(api): add POST /repos/:owner/:repo/pulls endpoint"
```

---

### Task 2: 服务端 API — `GET /api/repos/[owner]/[repo]/pull-for-branch` (查询分支关联 PR)

**Files:**

- Create: `server/api/repos/[owner]/[repo]/pull-for-branch.get.ts`

**Interfaces:**

- Consumes: `extractRepoParams(event)`, `getGitHubSessionContext(event)` → `{ octokit, userLogin }`, `getQuery(event)`
- Produces: `GET /api/repos/:owner/:repo/pull-for-branch?head=<branch>` endpoint, returns `{ pull: { number, title, state, html_url } | null }`

- [ ] **Step 1: Create the endpoint file**

```typescript
// server/api/repos/[owner]/[repo]/pull-for-branch.get.ts
import { extractRepoParams } from '#server/utils/repo-route-utils';

export default definePrivateApiCoalescedEventHandler(async (event) => {
  try {
    const { owner, repo } = extractRepoParams(event);
    const { octokit } = await getGitHubSessionContext(event);
    const head = getQuery(event).head;

    if (!head || typeof head !== 'string') {
      throw createError({ statusCode: 400, statusMessage: 'head query parameter is required' });
    }

    const { data } = await octokit.request('GET /search/issues', {
      q: `repo:${owner}/${repo} is:pr is:open head:${head}`,
      sort: 'updated',
      order: 'desc',
      per_page: 1,
    });

    const item = data.items?.[0];
    if (!item) {
      return { pull: null };
    }

    return {
      pull: {
        number: item.number,
        title: item.title,
        state: item.state,
        html_url: item.html_url,
      },
    };
  } catch (error) {
    // Silently return null on error to avoid noise in the local repo panel
    console.error('Failed to fetch pull request for branch:', error);
    return { pull: null };
  }
});
```

- [ ] **Step 2: Verify compilation**

```bash
pnpm typecheck
```

- [ ] **Step 3: Commit**

```bash
git add server/api/repos/[owner]/[repo]/pull-for-branch.get.ts
git commit -m "feat(api): add GET /repos/:owner/:repo/pull-for-branch endpoint"
```

---

### Task 3: 扩展 `LocalRepositoryCopy` 类型与 `RepoDetail.vue` copy 对象

**Files:**

- Modify: `app/composables/local-repository-panel/types.ts` (add new copy keys)
- Modify: `app/components/dashboard/RepoDetail.vue` (add zh/en copy values)

**Interfaces:**

- Produces: Updated `LocalRepositoryCopy` type with `createPullRequest`, `creatingPullRequest`, `pullRequestCreated`, `noPullRequest`, `pullRequestN`, `checkoutPR`, `checkingOutPR`, `cloneFirst`, `prAlreadyExists` strings

- [ ] **Step 1: Add new keys to `LocalRepositoryCopy` type**

Add after `watchers` in `app/composables/local-repository-panel/types.ts`:

```typescript
createPullRequest: string;
creatingPullRequest: string;
pullRequestCreated: string;
noPullRequest: string;
pullRequestN: string;
checkoutPR: string;
checkingOutPR: string;
cloneFirst: string;
prAlreadyExists: string;
```

- [ ] **Step 2: Add zh copy values in `RepoDetail.vue`**

Add inside the `if (locale.value.startsWith('zh'))` block (after `watchers: '关注者',`):

```typescript
      createPullRequest: '创建 Pull Request',
      creatingPullRequest: '创建中',
      pullRequestCreated: 'Pull Request 已创建',
      noPullRequest: '无关联 PR',
      pullRequestN: 'PR #{number}',
      checkoutPR: '检出到本地',
      checkingOutPR: '检出中',
      cloneFirst: '请先克隆仓库',
      prAlreadyExists: '已有关联 PR',
```

- [ ] **Step 3: Add en copy values in `RepoDetail.vue`**

Add inside the else block (after `watchers: 'Watchers',`):

```typescript
      createPullRequest: 'Create Pull Request',
      creatingPullRequest: 'Creating',
      pullRequestCreated: 'Pull Request created',
      noPullRequest: 'No PR',
      pullRequestN: 'PR #{number}',
      checkoutPR: 'Checkout locally',
      checkingOutPR: 'Checking out',
      cloneFirst: 'Clone the repository first',
      prAlreadyExists: 'PR exists',
```

- [ ] **Step 4: Commit**

```bash
git add app/composables/local-repository-panel/types.ts app/components/dashboard/RepoDetail.vue
git commit -m "feat: add LocalRepositoryCopy keys for PR linkage"
```

---

### Task 4: 前端 — PR 关联查询与创建 PR 方法 (扩展 `useLocalRepositoryPanel`)

**Files:**

- Modify: `app/composables/local-repository-panel/state.ts` (add PR state + `createPR` action)
- Modify: `app/composables/local-repository-panel/refreshers.ts` (add `refreshAssociatedPullRequest`, wire into git-status refresh)
- Modify: `app/composables/local-repository-panel/types.ts` (add `'createPR'` to `DesktopRepositoryAction`)
- Modify: `app/composables/useLocalRepositoryPanel.ts` (expose PR refs + `submitCreatePullRequest`)

**Interfaces:**

- Consumes: `apiFetch` from `useNekoGitApiFetch()` (auto-imported composable), existing `useLocalRepositoryPanelState`, `desktopRepository` computed
- Produces:
  - `associatedPullRequest: Ref<{ number: number; title: string; state: string; html_url: string } | null>`
  - `prLoading: Ref<boolean>`
  - `createPullRequestTitle / createPullRequestBody / createPullRequestBaseBranch: Ref<string>`
  - `refreshAssociatedPullRequest(): Promise<void>`
  - `submitCreatePullRequest(): Promise<unknown>` (returns created PR object on success, throws on error)

- [ ] **Step 1: Add `'createPR'` to `DesktopRepositoryAction`**

In `app/composables/local-repository-panel/types.ts`:

```typescript
export type DesktopRepositoryAction =
  | 'clone'
  | 'commit'
  | 'copy'
  | 'createPR'
  | 'fetch'
  | 'open'
  | 'pull'
  | 'push'
  | 'stash'
  | 'terminal'
  | null;
```

- [ ] **Step 2: Add PR state to `useLocalRepositoryPanelState`**

In `app/composables/local-repository-panel/state.ts`, change `import { ref } from 'vue';` to `import { ref, shallowRef } from 'vue';`. Then add state refs after `desktopCloneCopied` (line 58):

```typescript
const associatedPullRequest = shallowRef<{
  number: number;
  title: string;
  state: string;
  html_url: string;
} | null>(null);
const prLoading = shallowRef(false);
const createPullRequestTitle = ref('');
const createPullRequestBody = ref('');
const createPullRequestBaseBranch = ref('');
```

And add these to the returned object (after `desktopCloneCopied,`):

```typescript
    associatedPullRequest,
    prLoading,
    createPullRequestTitle,
    createPullRequestBody,
    createPullRequestBaseBranch,
```

- [ ] **Step 3: Add `refreshAssociatedPullRequest` to `useLocalRepositoryPanelRefreshers`**

In `app/composables/local-repository-panel/refreshers.ts`, destructure `associatedPullRequest` and `prLoading` from `state` (add to the destructuring block after `desktopCloneCopied`/`desktopAction` is NOT there — add after `desktopAction`-adjacent keys; specifically add `associatedPullRequest, prLoading,` after `desktopStatusLoading,` in the destructure). Then add the function after `refreshDesktopLocalRepositoryGitStatus`:

```typescript
const refreshAssociatedPullRequest = async () => {
  const repository = desktopRepository.value;
  const branch = desktopLocalRepositoryGitStatus.value?.branch;
  if (!repository || !desktopAvailable.value || !branch) {
    associatedPullRequest.value = null;
    return null;
  }

  prLoading.value = true;
  try {
    const apiFetch = useNekoGitApiFetch();
    const { pull } = await apiFetch<{
      pull: { number: number; title: string; state: string; html_url: string } | null;
    }>(
      `/api/repos/${repository.owner}/${repository.repo}/pull-for-branch?head=${encodeURIComponent(branch)}`
    );
    associatedPullRequest.value = pull;
    return pull;
  } catch {
    associatedPullRequest.value = null;
    return null;
  } finally {
    prLoading.value = false;
  }
};
```

Then wire it into the git-status refresh success path. In `refreshDesktopLocalRepositoryGitStatus`, after `desktopLocalRepositoryGitStatus.value = status;` add:

```typescript
void refreshAssociatedPullRequest();
```

And add `refreshAssociatedPullRequest,` to the returned object (after `refreshDesktopLocalRepositoryBranches,`):

```typescript
  return {
    previewDesktopChangedFileDiff,
    refreshAssociatedPullRequest,
    refreshDesktopLocalRepositoryBranches,
    ...
```

- [ ] **Step 4: Expose PR state + `submitCreatePullRequest` in `useLocalRepositoryPanel`**

In `app/composables/useLocalRepositoryPanel.ts`:

(a) Destructure the new state refs from `panelState` (add to the existing destructure block, after `desktopStatusLoading,`):

```typescript
    associatedPullRequest,
    prLoading,
    createPullRequestTitle,
    createPullRequestBody,
    createPullRequestBaseBranch,
```

(b) Destructure the new refresher (add to the existing destructure after `previewDesktopChangedFileDiff,`):

```typescript
    refreshAssociatedPullRequest,
```

(c) Add the `submitCreatePullRequest` method (add after `copyDesktopCloneUrl`, before `onMounted`):

```typescript
const submitCreatePullRequest = async () => {
  const repository = desktopRepository.value;
  const branch = desktopLocalRepositoryGitStatus.value?.branch;
  const base = createPullRequestBaseBranch.value.trim();
  const title = createPullRequestTitle.value.trim();
  if (
    !repository ||
    !desktopLocalRepositoryStatus.value?.exists ||
    !branch ||
    !base ||
    !title ||
    desktopAction.value
  ) {
    return;
  }

  desktopAction.value = 'createPR';
  try {
    const apiFetch = useNekoGitApiFetch();
    const pull = await apiFetch(`/api/repos/${repository.owner}/${repository.repo}/pulls`, {
      method: 'POST',
      body: {
        head: branch,
        base,
        title,
        body: createPullRequestBody.value.trim() || undefined,
      },
    });
    createPullRequestTitle.value = '';
    createPullRequestBody.value = '';
    void refreshAssociatedPullRequest();
    return pull;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create pull request.';
    await showDesktopMessage(message, 'error');
    throw error;
  } finally {
    desktopAction.value = null;
  }
};
```

> Note: `apiFetch` is auto-imported via `useNekoGitApiFetch()` which is a Nuxt auto-imported composable from `app/composables/`. Call `useNekoGitApiFetch()` at the top of each function that needs it (following the existing `useNekoGitApiFetch()` usage in `useDashboardDetails`).

(d) Add to the returned object (after `copyDesktopCloneUrl,`):

```typescript
    associatedPullRequest,
    prLoading,
    createPullRequestTitle,
    createPullRequestBody,
    createPullRequestBaseBranch,
    refreshAssociatedPullRequest,
    submitCreatePullRequest,
```

- [ ] **Step 5: Verify compilation**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add app/composables/useLocalRepositoryPanel.ts app/composables/local-repository-panel/state.ts app/composables/local-repository-panel/refreshers.ts app/composables/local-repository-panel/types.ts
git commit -m "feat: add PR association and creation methods to useLocalRepositoryPanel"
```

---

### Task 5: 前端 — PR 关联徽章展示 (LocalRepositoryGitSummary)

**Files:**

- Modify: `app/components/dashboard/repo/LocalRepositoryGitSummary.vue`

**Interfaces:**

- Consumes: `state.associatedPullRequest`, `state.prLoading`, `state.desktopLocalRepositoryGitStatus.value.branch`, router navigation to dashboard PR detail
- Produces: PR badge shown next to branch name when PR exists, navigates to dashboard PR detail on click

- [ ] **Step 1: Add PR badge to the template**

In `LocalRepositoryGitSummary.vue`, add after the branch display (after `state.desktopGitBranchLabel.value`):

```vue
<span
  v-if="state.associatedPullRequest.value"
  class="local-repo-git__pr-badge"
  :title="state.associatedPullRequest.value.title"
  @click="openAssociatedPullRequest"
>
  <GitPullRequestIcon :size="12" />
  <span>#{{ state.associatedPullRequest.value.number }}</span>
</span>
<span
  v-else-if="state.prLoading.value"
  class="local-repo-git__pr-badge local-repo-git__pr-badge--loading"
>
  <Loader2Icon :size="10" class="spin-animation" />
</span>
```

- [ ] **Step 2: Add import and handler**

Add to script section (use `useRouter` + `localePath` to navigate to the dashboard PR detail overlay, matching `useDashboardDetails.openPR`'s URL construction):

```typescript
import { GitPullRequestIcon } from 'lucide-vue-next';
import { useRouter } from 'vue-router';

const { copy, state } = useLocalRepositoryPanelContext();
const router = useRouter();
const localePath = useLocalePath();

const openAssociatedPullRequest = () => {
  const pr = state.associatedPullRequest.value;
  const repo = state.desktopRepository.value;
  if (!pr || !repo) return;

  void router.push({
    path: localePath('/dashboard'),
    query: {
      tab: 'repos',
      pr: `${repo.owner}/${repo.repo}/${pr.number}`,
    },
  });
};
```

> Note: the `tab` query keeps the user on the repos tab; the `pr` query value format `owner/repo/number` is what `useDashboardDetails` reads to open the PR detail overlay.

- [ ] **Step 3: Add styles**

```scss
.local-repo-git__pr-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  padding: 0.1rem 0.4rem;
  border: 1px solid var(--nekogit-border);
  border-radius: 999px;
  background: var(--nekogit-surface);
  color: var(--nekogit-info);
  font-size: 0.7rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;

  &:hover {
    background: var(--nekogit-info-soft);
    border-color: var(--nekogit-info);
  }
}

.local-repo-git__pr-badge--loading {
  cursor: default;
  opacity: 0.5;
}
```

- [ ] **Step 4: Commit**

```bash
git add app/components/dashboard/repo/LocalRepositoryGitSummary.vue
git commit -m "feat: show PR association badge in local repository git summary"
```

---

### Task 6: 前端 — "Create PR" 按钮与表单 (LocalRepositoryActions)

**Files:**

- Modify: `app/components/dashboard/repo/LocalRepositoryActions.vue`
- Create: `app/components/dashboard/repo/CreatePullRequestForm.vue`

**Interfaces:**

- Consumes: `state.associatedPullRequest`, `state.desktopLocalRepositoryGitStatus`, `state.submitCreatePullRequest`, `state.createPullRequestTitle`, `state.createPullRequestBody`, `state.createPullRequestBaseBranch`, `state.desktopAction`
- Produces: "Create PR" button + modal form

- [ ] **Step 1: Create the form component**

```vue
<!-- CreatePullRequestForm — NekoGit dashboard component. -->
<script setup lang="ts">
import { GitPullRequestIcon, Loader2Icon, XIcon } from 'lucide-vue-next';
import { onMounted } from 'vue';
import { useLocalRepositoryPanelContext } from './localRepositoryPanelContext';

const emit = defineEmits<{
  close: [];
  created: [pull: any];
}>();

const { copy, state } = useLocalRepositoryPanelContext();

// Pre-fill base branch from repo default branch on mount
onMounted(async () => {
  if (!state.createPullRequestBaseBranch.value) {
    const repo = state.desktopRepository.value;
    if (repo) {
      try {
        const apiFetch = useNekoGitApiFetch();
        const { default_branch } = await apiFetch<{ default_branch: string }>(
          `/api/repos/${repo.owner}/${repo.repo}/default-branch`
        );
        state.createPullRequestBaseBranch.value = default_branch;
      } catch {
        // Fallback: leave empty for user to type
      }
    }
  }
});

const handleSubmit = async () => {
  try {
    const pull = await state.submitCreatePullRequest();
    if (pull) {
      emit('created', pull);
    }
  } catch {
    // Error handled within the composable
  }
};
</script>

<template>
  <div class="create-pr-overlay" @click.self="emit('close')">
    <div class="create-pr-form card">
      <div class="create-pr-form__header">
        <span class="create-pr-form__title">
          <GitPullRequestIcon :size="16" />
          {{ copy.createPullRequest }}
        </span>
        <button class="create-pr-form__close" type="button" @click="emit('close')">
          <XIcon :size="16" />
        </button>
      </div>
      <div class="card-content">
        <div class="field">
          <label class="label">{{ copy.gitSwitchBranch }}</label>
          <input
            class="input"
            :value="state.desktopLocalRepositoryGitStatus.value?.branch"
            disabled
          />
        </div>
        <div class="field">
          <label class="label">Base</label>
          <input
            v-model="state.createPullRequestBaseBranch.value"
            class="input"
            type="text"
            :placeholder="copy.gitBranch"
          />
        </div>
        <div class="field">
          <label class="label">{{ copy.gitCommitMessage }}</label>
          <input
            v-model="state.createPullRequestTitle.value"
            class="input"
            type="text"
            placeholder="PR title"
            required
          />
        </div>
        <div class="field">
          <label class="label">Description</label>
          <textarea
            v-model="state.createPullRequestBody.value"
            class="textarea"
            rows="4"
            placeholder="PR description (optional)"
          />
        </div>
        <div class="create-pr-form__actions">
          <button class="button is-light" type="button" @click="emit('close')">
            {{ copy.gitCopied }}
          </button>
          <button
            class="button is-primary"
            type="button"
            :disabled="
              !state.createPullRequestTitle.value.trim() || state.desktopAction.value === 'createPR'
            "
            @click="handleSubmit"
          >
            <Loader2Icon
              v-if="state.desktopAction.value === 'createPR'"
              :size="14"
              class="spin-animation"
            />
            <GitPullRequestIcon v-else :size="14" />
            <span>{{
              state.desktopAction.value === 'createPR'
                ? copy.creatingPullRequest
                : copy.createPullRequest
            }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.create-pr-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.4);
}

.create-pr-form {
  width: min(90vw, 36rem);
  max-height: 90vh;
  overflow-y: auto;
}

.create-pr-form__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--nekogit-border);
}

.create-pr-form__title {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  font-size: 1rem;
}

.create-pr-form__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--nekogit-text-muted);
  cursor: pointer;
  border-radius: 4px;

  &:hover {
    background: var(--nekogit-surface-hover);
    color: var(--nekogit-text-strong);
  }
}

.create-pr-form__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1rem;
}
</style>
```

- [ ] **Step 2: Add "Create PR" button to `LocalRepositoryActions.vue`**

Add a new button block after the `copyDesktopCloneUrl` button (or after the `stash` button), with these conditions:

```vue
<template
  v-if="
    state.desktopLocalRepositoryGitStatus.value?.upstream &&
    state.desktopLocalRepositoryGitStatus.value?.clean
  "
>
  <button
    v-if="!state.associatedPullRequest.value"
    class="local-repo-link local-repo-panel__action local-repo-panel__action--wide"
    :disabled="Boolean(state.desktopAction.value)"
    @click="showCreatePRForm = true"
  >
    <GitPullRequestIcon v-if="state.desktopAction.value !== 'createPR'" :size="14" />
    <Loader2Icon v-else :size="14" class="spin-animation" />
    <span>{{ copy.createPullRequest }}</span>
  </button>
  <span
    v-else
    class="local-repo-link local-repo-panel__action local-repo-panel__action--wide local-repo-panel__action--pr-exists"
  >
    <GitPullRequestIcon :size="14" />
    <span>{{ copy.prAlreadyExists }}</span>
  </span>
</template>
```

Add `import { GitPullRequestIcon } from 'lucide-vue-next';` and `const showCreatePRForm = ref(false);`.

Add the form overlay:

```vue
<CreatePullRequestForm
  v-if="showCreatePRForm"
  @close="showCreatePRForm = false"
  @created="handlePRCreated"
/>
```

- [ ] **Step 3: Add `handlePRCreated` handler**

```typescript
const handlePRCreated = async (pull: any) => {
  showCreatePRForm.value = false;
  // Refresh associated PR
  await state.fetchAssociatedPullRequest();
};
```

- [ ] **Step 4: Commit**

```bash
git add app/components/dashboard/repo/CreatePullRequestForm.vue app/components/dashboard/repo/LocalRepositoryActions.vue
git commit -m "feat: add Create PR button and form in local repository panel"
```

---

### Task 7: 前端 — PR 详情页 "Checkout Locally" 按钮

**Files:**

- Modify: `app/components/dashboard/PRDetail.vue`

**Interfaces:**

- Consumes: `useDesktopRuntime()` → `{ available, checkoutRemoteLocalRepositoryBranch, getLocalRepositoryStatus }`, `repoOwner`, `repoName`, `currentPullRequest.value.head.ref`
- Produces: "Checkout Locally" button (desktop only) in PR sidebar

- [ ] **Step 1: Add composable and state**

In `PRDetail.vue` script, add:

```typescript
import { useDesktopRuntime } from '~/composables/useDesktopRuntime';

const {
  available: desktopAvailable,
  checkoutRemoteLocalRepositoryBranch,
  getLocalRepositoryStatus,
} = useDesktopRuntime();
const checkoutPRLoading = shallowRef(false);
const checkoutPRError = shallowRef('');
```

- [ ] **Step 2: Add checkout handler**

```typescript
const checkoutPullRequestLocally = async () => {
  const headRef = currentPullRequest.value?.head?.ref;
  if (!headRef || !repoOwner.value || !repoName.value) return;

  checkoutPRLoading.value = true;
  checkoutPRError.value = '';

  try {
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
```

- [ ] **Step 3: Add button to template**

In `PRDetail.vue` sidebar, after the "Open Review" button block (around line 94-106):

```vue
<div v-if="desktopAvailable.value" class="sidebar-card mt-4">
  <div class="sidebar-card__content">
    <button
      class="sidebar-review-btn"
      type="button"
      :disabled="checkoutPRLoading"
      @click="checkoutPullRequestLocally"
    >
      <Loader2Icon v-if="checkoutPRLoading" :size="14" class="spin-animation" />
      <GitBranchIcon v-else :size="14" />
      <span>{{ checkoutPRLoading ? t('prReview.checkingOut') : t('prReview.checkoutLocally') }}</span>
    </button>
    <p v-if="checkoutPRError" class="sidebar-card__error mt-2">
      {{ checkoutPRError }}
    </p>
  </div>
</div>
```

- [ ] **Step 4: Add i18n keys**

In `en.json` under `prReview`:

```json
"checkoutLocally": "Checkout locally",
"checkingOut": "Checking out",
"cloneFirst": "Clone the repository first"
```

In `zh-cn.json` under `prReview`:

```json
"checkoutLocally": "检出到本地",
"checkingOut": "检出中",
"cloneFirst": "请先克隆仓库"
```

- [ ] **Step 5: Add icon import**

```typescript
import { GitBranchIcon } from 'lucide-vue-next';
```

- [ ] **Step 6: Commit**

```bash
git add app/components/dashboard/PRDetail.vue i18n/locales/en.json i18n/locales/zh-cn.json
git commit -m "feat: add Checkout Locally button in PR detail sidebar"
```

---

### Task 8: 国际化 — 更新 i18n 文件

**Files:**

- Modify: `i18n/locales/en.json`
- Modify: `i18n/locales/zh-cn.json`

- [ ] **Step 1: Add en keys**

In `i18n/locales/en.json`, add under `prReview`:

```json
"checkoutLocally": "Checkout locally",
"checkingOut": "Checking out",
"cloneFirst": "Clone the repository first"
```

- [ ] **Step 2: Add zh-cn keys**

In `i18n/locales/zh-cn.json`, add under `prReview`:

```json
"checkoutLocally": "检出到本地",
"checkingOut": "检出中",
"cloneFirst": "请先克隆仓库"
```

- [ ] **Step 3: Commit**

```bash
git add i18n/locales/en.json i18n/locales/zh-cn.json
git commit -m "i18n: add PR linkage translations"
```

---

### Task 9: 验证

**Files:** None (run verification commands)

- [ ] **Step 1: Run all tests**

```bash
pnpm test
```

Expected: all 133+ tests pass (no existing tests should break).

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

- [ ] **Step 4: Rust check**

```bash
cargo check --manifest-path src-tauri/Cargo.toml
```

Expected: compiles cleanly.

- [ ] **Step 5: Commit any remaining changes**

```bash
git add -A
git commit -m "chore: fix lint/type issues after PR linkage implementation"
```
