# NekoGit 阶段 1：本地↔远程联动 + 自动化设计文档

- 日期：2026-08-04
- 状态：已获用户认可
- 范围：阶段 1 本地↔远程联动 + 自动化（方案 A 的第一阶段）

## 背景与目标

NekoGit 定位为个人开发者效率工具。用户选择先打通「本地改代码 → 开 PR → 审 PR → 看 CI」工作流中的本地↔远程环节：

1. **加深本地-远程联动**：本地 branch ↔ 远程 PR 双向关联，提交/推送后直接关联或打开对应 PR。
2. **本地操作自动化**：从本地仓库直接开 PR、创建分支+提交+推送的一体化流程。

本项目只覆盖阶段 1；PR Review 体验增强（阶段 2）与 CI 检查集成（阶段 3）属于后续阶段，不在本文档范围内。

## 现状基础（可复用）

- **Rust 侧 Git 层已完备**：`clone / fetch / pull / push / commit / stash / switch / create-branch / checkout-remote`，位于 `src-tauri/src/local_repository/`。
  - `DesktopLocalRepositoryGitStatus` 已含 `branch`、`upstream`、`ahead/behind`、`clean` 字段（`src-tauri/src/local_repository/types.rs:48`）。
  - 检出远程分支命令 `checkoutRemoteLocalRepositoryBranch` 已存在（`src-tauri/src/local_repository/write/branches.rs:80`）。
- **前端已封装全部命令**：`useDesktopRuntime.ts` 与 `useLocalRepositoryPanel.ts` 提供完整桌面命令入口。
- **本地仓库面板 UI 已存在**：`LocalRepositoryPanel.vue`（GitSummary / ChangedFiles / CommitHistory / Actions）。
- **PR 详情 API 已存在**：`GET /api/pulls/[owner]/[repo]/[pull_number].get.ts`。
- **GitHub 认证上下文工具已存在**：`getGitHubSessionContext(event)` 返回 `{ octokit, userLogin }`。

**缺失项**：

- PR 创建端点（无 `POST pulls`）。
- 本地分支 ↔ PR 关联查询端点。
- 本地仓库面板中的 PR 关联展示与「创建 PR」入口。
- PR 详情页的「Checkout Locally」桌面检出按钮。

## 服务端 API 设计（新增 2 个）

### 1. `POST /api/repos/[owner]/[repo]/pulls` — 创建 PR

- 请求体：`{ head: string, base: string, title: string, body?: string }`
  - `head`：来源分支（必填，来自本地当前分支）
  - `base`：目标分支（必填，默认取仓库默认分支）
  - `title`：标题（必填，前端校验非空）
  - `body`：描述（可选）
- 实现：调用 `octokit.rest.pulls.create({ owner, repo, head, base, title, body })`。
- 返回：完整 PR 对象（含 `number`、`html_url`、`title`、`state` 等），前端据此跳转 PR 详情。
- 错误处理：捕获 GitHub API 错误并提取用户可读消息（仓库不存在 / 无权限 / 已有 PR 冲突）。

### 2. `GET /api/repos/[owner]/[repo]/pull-for-branch?head=<branch>` — 查询分支关联 PR

- 查询参数：`head`（必填，当前本地分支名）。
- 实现：`octokit.search.issues({ q: 'repo:owner/repo is:pr head:<branch> is:open' })`，按 `updated_at` 降序取最新一条。
- 返回：`{ pull: { number, title, state, html_url } | null }`。
- 错误处理：查询失败静默返回 `{ pull: null }`，不向前端抛出错误（避免噪音）。

## 前端本地仓库面板增强

### GitSummary 区域 — PR 关联徽章

- 当前分支有 `upstream` 且仓库存在时，异步调用 `pull-for-branch`。
- 有 PR → 显示徽章：`#123 · 标题`，点击跳转到该 PR 详情（复用 `useDashboardDetails` 的 `openPR`）。
- 无 PR → 不显示。
- 查询失败 → 静默隐藏。

### Actions 区域 — Create PR 按钮

- **显示条件**：仓库已 clone、有 upstream、工作区 clean、当前分支无已关联 PR。
- **交互**：点击弹出表单弹窗（标题、描述、目标分支下拉，默认仓库默认分支）。
- **提交**：调用新 `POST pulls` API，成功后跳转新 PR 详情，并刷新 PR 关联状态。
- **校验**：标题非空才允许提交；网络错误显示明文提示。
- push 成功后自动刷新 PR 关联状态。

## 桌面端联动（无新增 Rust 命令）

- PR 详情页新增 **"Checkout Locally"** 按钮（仅桌面环境可见）：
  - 若本地已有该仓库 → 调用现有 `checkoutRemoteLocalRepositoryBranch` 检出 `head` 分支。
  - 若本地无该仓库 → 提示先 Clone。
  - 若本地有未提交改动 → 复用 Rust 侧校验返回「请先 commit 或 stash」。
  - 完成后通过现有 refreshers 刷新本地仓库状态。

## 错误处理边界

| 场景                       | 处理方式                                 |
| -------------------------- | ---------------------------------------- |
| 当前分支无 upstream        | 不显示 PR 关联，也不显示 Create PR       |
| 分支已有 PR                | 显示现有 PR 徽章（#123），禁用 Create PR |
| 搜索查询返回多个 PR        | 取最新一个（按 updated_at 降序）         |
| 创建 PR 标题为空           | 前端校验，不允许提交                     |
| 仓库不存在 / 无权限        | 从 GitHub API 错误中提取明文提示         |
| 检出 PR 时本地无 clone     | 提示先 Clone 仓库                        |
| 检出 PR 时本地有未提交改动 | 返回「请先 commit 或 stash」             |
| PR 关联查询网络错误        | 静默忽略，不显示关联也不报错             |
| push 失败                  | 不显示 Create PR，保持原状态             |

## 实现顺序

1. 服务端：`POST /api/repos/[owner]/[repo]/pulls` → 创建 PR
2. 服务端：`GET /api/repos/[owner]/[repo]/pull-for-branch` → 查询分支关联 PR
3. 前端：扩展 `useLocalRepositoryPanel` → 集成 PR 关联查询 + 创建 PR 方法
4. 前端：GitSummary 增加 PR 关联徽章展示
5. 前端：Actions 区增加「Create PR」按钮 + 表单弹窗
6. 前端：PR 详情页增加「Checkout Locally」桌面按钮
7. 国际化：新增中英文文案

## 测试策略

- 服务端 API 按现有模式（`definePrivateApiCoalescedEventHandler` + `getGitHubSessionContext`）实现，遵循 `server/api/` 既有风格。
- 对可测试的纯逻辑（如 PR 关联数据规范化、错误消息提取）补充 Vitest 单测，放置于 `tests/` 下。
- Rust 侧无新增命令，不需要新增 Rust 测试。
- 完成后运行 `pnpm test`、`pnpm typecheck`、`pnpm lint`、`cargo check` 验证。

## 不做的事（YAGNI）

- 不实现阶段 2（Review 体验增强）与阶段 3（CI 检查集成）。
- 不新增 Rust 桌面命令。
- 不实现多 PR 同分支的列表选择（只取最新）。
- 不实现 PR 草稿（draft）创建选项。
