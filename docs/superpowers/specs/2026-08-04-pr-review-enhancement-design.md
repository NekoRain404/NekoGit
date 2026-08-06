# NekoGit 阶段 2：PR Review 体验增强设计文档

- 日期：2026-08-04
- 状态：已获用户认可
- 范围：方案 A 的第二阶段

## 目标

增强 PR Code Review 体验：提交级导航、快捷操作（approve/merge/close）、diff 上下文展开。

## 现有基础

- `PRReviewWorkspace.vue`：文件级导航（Alt+J/K）、diff 查看、行内评论、submit review（APPROVE/COMMENT/REQUEST_CHANGES）
- `usePRReview.ts`：完整的 review 工作流 composable
- `PRReviewDiffViewer.vue` + `PRReviewVirtualDiffRows.vue`：虚拟滚动 diff 渲染
- `PRHeader.vue`：纯展示组件（无操作按钮）
- `PRActions.vue`：侧边栏信息卡（reviewers、details、stats）
- 服务端已有 `POST /pulls/{pull_number}/reviews` 提交 review

## 新增服务端 API

### 1. `PATCH /api/repos/[owner]/[repo]/pulls/[pull_number]` — 更新 PR

- body: `{ state?: 'closed' | 'open', merge?: boolean, merge_method?: 'merge' | 'squash' | 'rebase' }`
- 调 `octokit.rest.pulls.update` 或 `octokit.rest.pulls.merge`
- 返回更新后的 PR 对象

## 前端增强

### 1. PRHeader 快捷操作

- **Approve / Request Changes 快捷按钮**（不打开完整 review workspace）：点击后调用 `POST /pulls/{pull_number}/reviews` 直接提交 event（body 为空字符串，COMMENT 事件需 body）
- **Merge PR 按钮**（仅当 PR 可合并时显示）：调用 `PATCH pulls` 带 `{ merge: true }`
- **Close / Reopen PR 按钮**：调用 `PATCH pulls` 带 `{ state: 'closed' | 'open' }`

### 2. PRReviewWorkspace 提交级导航

- 在 workspace header 添加 commit 下拉选择器，列出 PR 所有 commits（通过 `GET /pulls/{pull_number}/commits`）
- 切换 commit 时重新加载该 commit 的 diff 文件（`GET /pulls/{pull_number}/files` 使用该 commit 的 `sha` 作为参数）
- 显示当前 commit 的 SHA、作者、提交信息摘要

### 3. Diff 上下文展开

- 在 `PRReviewDiffViewer.vue` 中，每个 hunk 头添加展开按钮（+3 行/+5 行/+10 行上下文）
- 点击后通过 `GET /repos/{owner}/{repo}/blobs/{sha}` 或 `GET /repos/{owner}/{repo}/contents/{path}?ref={sha}` 获取更多上下文行
- 保持 `isCommentable` 属性以支持行内评论

## 实现顺序

1. 服务端：`PATCH /api/repos/[owner]/[repo]/pulls/[pull_number]`（merge/close）
2. 前端：PRHeader 快捷操作（approve/merge/close）
3. 前端：PRReviewWorkspace 提交级导航
4. 前端：Diff 上下文展开
5. i18n 文案

## 不做的事（YAGNI）

- 不实现 review 工作区中的多 commit 选择 diff（只在 workspace header 切换，不改变底层 diff API）
- 不实现 inline suggestion 编辑
- 不实现 review 草稿保存