# NekoGit 阶段 3：CI 检查集成设计文档

- 日期：2026-08-04
- 状态：已获用户认可
- 范围：方案 A 的第三阶段

## 目标

在 PR 详情中集成 GitHub Actions / Checks API，显示检查状态、重跑失败任务、查看日志。

## 现有基础

- 零 CI 基础设施，无 checks 相关端点或组件
- 但已有完整的 Octokit 客户端、PR 详情页布局、侧边栏组件模式

## 新增服务端 API

### 1. `GET /api/repos/[owner]/[repo]/pulls/[pull_number]/checks` — 获取 PR 的 check runs

- 获取 PR 的 head commit SHA，调 `GET /repos/{owner}/{repo}/commits/{ref}/check-runs`（Checks API）
- 同时获取 `GET /repos/{owner}/{repo}/commits/{ref}/status`（combined status）作为补充
- 返回：`{ check_runs: CheckRun[], total_count: number, combined_status: { state, statuses } }`

### 2. `GET /api/repos/[owner]/[repo]/pulls/[pull_number]/checks/[run_id]/logs` — 获取 check run 日志

- 调 `GET /repos/{owner}/{repo}/check-runs/{run_id}` 获取 `check_run.details_url`
- 代理下载日志内容（GitHub Actions 日志）
- 返回文本内容

### 3. `POST /api/repos/[owner]/[repo]/pulls/[pull_number]/checks/[run_id]/rerun` — 重跑 check run

- 调 `POST /repos/{owner}/{repo}/check-runs/{run_id}/rerun`
- 返回更新后的 check run 对象

## 前端增强

### 1. PR 详情侧边栏 CI 状态面板

- 在 `PRDetail.vue` 侧边栏新增 CI 面板（在 PRActions 下方）
- 显示 check runs 列表：每个 run 显示名称、结论（pass/fail/pending/skipped）、图标颜色
- 总览行：`X passing, Y failing, Z pending`
- 仅显示 head commit 的 checks（默认）

### 2. 重跑失败任务

- 每个失败的 check run 旁显示「重跑」按钮
- 调用 `POST /checks/[run_id]/rerun`
- 成功后刷新 checks 列表

### 3. 日志查看

- 每个 check run 旁显示「查看日志」链接
- 点击后在新标签页打开 GitHub Actions 日志 URL（或通过代理端点）

## 实现顺序

1. 服务端：`GET /api/repos/[owner]/[repo]/pulls/[pull_number]/checks`
2. 服务端：`POST /api/repos/[owner]/[repo]/pulls/[pull_number]/checks/[run_id]/rerun`
3. 服务端：`GET /api/repos/[owner]/[repo]/pulls/[pull_number]/checks/[run_id]/logs`
4. 前端：CI 状态面板组件
5. 前端：重跑 + 日志按钮
6. i18n 文案

## 不做的事（YAGNI）

- 不实现 workflow 运行详情页（只显示 check runs 摘要）
- 不实现日志内联查看（通过 GitHub 链接打开）
- 不实现 CI 历史趋势
