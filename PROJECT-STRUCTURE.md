# NekoGit 项目结构说明

## 项目概览

NekoGit 是一个单页 GitHub 工作台：以 **Nuxt 4 + Vue 3 + TypeScript** 构建 Web 前端，**Nitro** 作为服务端并代理 GitHub API，另有基于 **Rust/Tauri** 的 Linux 桌面客户端（内置并管理打包后的 Nitro 服务）。Web 端支持通知、Issue、PR、仓库、自定义搜索 Tab、Markdown / Mermaid 渲染；桌面端额外提供系统托盘、原生菜单、`nekogit://` URL 处理器与本地仓库工作流（clone / fetch / pull / commit / stash / push / diff 预览等）。项目以 **AGPL-3.0** 协议开源，包管理使用 pnpm。

维护者请从 `docs/project-handoff.md` 开始阅读：其中包含 Ownership Boundaries（模块归属边界）、每日运行手册与发布检查清单。

## 顶层目录总览

| 目录 | 用途 |
|------|------|
| `app/` | Vue 前端（组件 / composables / 页面 / 工具函数 / 布局 / 插件 / 中间件） |
| `server/` | Nitro 服务端（API 路由 / 非 API 路由 / 工具 / 中间件 / 插件） |
| `shared/` | 前后端共享的类型定义与跨端工具（CSRF、代理 URL、速率限制等） |
| `src-tauri/` | Rust/Tauri 桌面客户端（Rust 模块、权限、打包配置） |
| `tests/` | Vitest 单元测试 |
| `scripts/` | 构建脚本（Tauri/Nuxt 集成、Node 运行时与 Nitro 输出打包） |
| `i18n/` | 国际化文案（`en.json` / `zh-cn.json`） |
| `docs/` | 项目文档（handoff、桌面 Git 工作流） |
| `public/` | 静态资源（favicon、图标、robots.txt） |
| `release/` | Linux 发布产物（`.deb`、portable tar.gz） |

其他根文件：`nuxt.config.ts`（Nuxt/Nitro 配置，含认证、存储、字体、i18n）、`package.json`（脚本与依赖）、`tsconfig.json`（Nuxt 生成的三方 tsconfig 引用）、`pnpm-workspace.yaml` / `.npmrc`（pnpm 配置，registry 固定为 npmmirror）、`LICENSE`、`README.md` / `README.zh-CN.md`。

## 前端架构 (app/)

Nuxt 4 的 `app/` 目录。视图组件位于 `components/`，状态化工作流逻辑位于 `composables/`，页面按路由放于 `pages/`。约定：页面/详情组件应组合聚焦的小组件，而不是堆积业务逻辑。

- `app/app.vue` — Nuxt 根组件
- `app/error.vue` — 错误页
- `app/layouts/` — `landing.vue`（登录/落地页布局）、`dashboard.vue`（主工作台布局）
- `app/middleware/auth.global.ts` — 全局认证中间件
- `app/plugins/` — 客户端插件：CSRF 注入（`00.csrf.client.ts`）、GitHub 链接处理、桌面命令/导航/窗口标题绑定、用户设置
- `app/assets/` — SCSS（`main.scss`、`card.scss`、组件级样式如 `components/_local-repository-panel.scss`）
- `app/app.vue` 之上还有 `i18n` 文案（见 `i18n/locales/`）

### app/components/ — Vue 组件

按功能子目录组织的 dashboard 生态：

- `activity-bar/` — 左侧活动栏（`ActivityBar.vue`）
- `discussion/` — Discussion 详情卡片与操作（Comments、Composer、Answer、ReplyList、Header、Actions）
- `issue/` — Issue 详情（Header、Actions、Labels、Timeline 系列卡片、LockReasonModal）
- `pr/` — PR 详情与评审（Header、Actions、ChecksPanel、Labels、ReviewerPicker、ReviewWorkspace 系列、Timeline 系列）
- `repo-files/` — 仓库文件浏览（`BranchSelector.vue`、`RepoFileView.vue`）
- `repo/` — 仓库面板（`CreatePullRequestForm.vue`、本地仓库 LocalRepository 系列组件）
- `tab-sidebar/` — 左侧 Tab 边栏（`TabSidebar.vue`）
- `tabs-settings/` — 自定义 Tab 编辑（`TabsEditorPanel.vue`、`TabsSettingsPage.vue`、`TabsViewsPanel.vue`）
- `timeline/` — 通用时间线组件（CommentComposer、TimelineCommentCard、ReferenceSubject、EventActorRow、ProjectTag）
- `widgets/` — 快捷操作与过滤器（QuickActions、QuickFilters、TabStats、WidgetsPanel）

顶层 dashboard 组件（`app/components/dashboard/`）：`DashboardLayout.vue`、`DashboardLoadingList.vue`、`DashboardPagination.vue`、`DashboardQuickOpenPalette.vue`、`DetailOverlay.vue` / `DetailOverlayHost.vue`（滑出式详情面板）、各详情页 `DiscussionDetail.vue` / `IssueDetail.vue` / `PRDetail.vue` / `RepoDetail.vue`、`RepoFileTree.vue`、列表项 `NotificationItem.vue` / `RepoItem.vue` / `SearchItem.vue`、`SearchResultPreview.vue`、`TokenizedQuery.vue`。

其他目录：`auth/`（`AuthGateway.vue`、`AuthenticatedLandingCard.vue`、`PersonalLockForm.vue`）、`layouts/`（导航栏 `Navbar.vue`、`LandingNavbar.vue`）、`ui/`（按钮、Markdown/Mermaid 渲染、模态、颜色模式、圆图等通用组件）。

### app/composables/ — 状态逻辑

前端状态与工作流组合层：

- `useGithubData.ts` — 核心数据加载（通知/Issue/PR/仓库列表）
- `useDashboardDetails.ts` — 详情面板状态
- `usePRReview.ts` — PR 评审工作流
- `useLocalRepositoryPanel.ts` — 本地仓库面板工作流编排
- `useDesktopRuntime.ts` — **稳定的桌面运行时组合/导出表面**，前端消费 Tauri 命令的统一入口
- `useRealtimeNotifications.ts`、`useCustomTabs.ts`、`useTabGroups.ts`、`useDashboardTabs.ts`、`useTabsSettingsPage.ts`、`useTabMigration.ts` — Tab 与通知
- `useUserSettings.ts`、`useCustomTabSettingsOptions.ts` — 用户设置
- `useNekoGitApiFetch.ts` — 封装后的 API fetch（携带 CSRF）
- 导航类：`useDashboardUrlNavigation.ts`、`useDesktopNavigation.ts`、`useCurrentGitHubUrl.ts`、`useUrlHelper.ts`、`useClipboardGithubNavigation.ts`、`useClipboardReader/Writer.ts`
- 其他工具：`useModalState.ts`、`useFileDownloader.ts`、`useRelativeTimeNow.ts`、`useAutoHideScrollState.ts`、`useIssueTimelineEvents.ts` / `usePRTimelineEvents.ts`、`useRepoFiles.ts`、`useDesktopNotifications.ts` 等

两个重点子目录：

- `desktop-runtime/` — Tauri invoke 安全层与命令包装：`invoke.ts`（invoke 封装）、`commands.ts`（通用桌面命令包装）、`localRepositoryCommands.ts`（本地仓库命令包装）、`types.ts`（前端 DTO 类型）。**约定**：使用新 Tauri 命令前，先在 `useDesktopRuntime.ts` 加一个类型化函数，包装放入 `commands.ts` 或 `localRepositoryCommands.ts`。
- `local-repository-panel/` — 面板专属状态：`state.ts`（面板状态）、`refreshers.ts`（读取侧刷新器）、`viewModel.ts`（视图模型推导）、`desktopDialogs.ts`（对话框助手）、`types.ts`（共享类型）。

### app/pages/ — 路由页面

| 路由 | 文件 | 说明 |
|------|------|------|
| `/` | `pages/index.vue` | 登录 / 落地页 |
| `/dashboard` | `pages/dashboard.vue` | 主工作台（通知/Issue/PR/仓库四个 Tab） |
| `/dashboard/repos/[owner]/[repo]` | `pages/dashboard/repos/[owner]/[repo].vue` | 仓库详情页 |
| `/dashboard/settings` | `pages/dashboard/settings.vue` | 设置页 |
| `/dashboard/settings/tabs` | `pages/dashboard/settings/tabs.vue` | Tab 编辑器 |
| `/dashboard/tabs` | `pages/dashboard/tabs.vue` | 自定义 Tab 视图 |

布局通过 `nuxt.config.ts` 的 `routeRules` 指定（`/` 用 landing，`/dashboard*` 用 dashboard）。

### app/utils/ — 纯函数工具

无状态工具函数，行为复杂时配有测试（见 `tests/`）：

- URL 解析与导航：`github-url-utils.ts`、`parseGitHubRepoPath.ts`、`parseGitHubMarkdownTarget.ts`、`parseGitHubNotificationSubjectTarget.ts`、`dashboard-url-navigation-utils.ts`、`dashboard-quick-open-utils.ts`、`current-github-url-utils.ts`
- 文件内容：`repo-file-content-utils.ts`（解码、大小格式化、扩展名解析、语法语言映射）、`repo-file-tree-utils.ts`、`markdown-repo-path-utils.ts`、`tokenizeCodeLine.ts`
- 快捷键：`keyboard-shortcut-utils.ts`
- 其他：`getRepoName.ts`、`formatDurationFromNow.ts`、`languageColors.ts`、`getTextColorFromBackground.ts`、`sanitizeHtml.ts`、`shiki-language-loader.ts`、`pr-review-workspace-state-utils.ts`、桌面相关 `desktop-window-title-utils.ts`、`desktop-notification-utils.ts` 等

## 服务端架构 (server/)

Nitro 服务端，职责包括：认证边界、向 GitHub API 代理请求（token 仅存在于加密会话 cookie）、CSRF 防护、用户设置存储。

### server/api/ — REST 端点

按资源分组的 REST 端点，动态路径遵循 `[owner]/[repo]/[pull_number]`（或 `[issue_number]` / `[discussion_number]` / `[thread_id]`）约定，`.get.ts` / `.post.ts` / `.patch.ts` / `.put.ts` / `.delete.ts` 后缀对应 HTTP 方法：

- `auth/providers.get.ts` — 认证提供商列表
- `discussions/` — discussion 与评论（含 `[comment_id]/replies`）
- `issues.get.ts`、`issues/[owner]/[repo]/[issue_number]` 与 `timeline`
- `notifications.get.ts`、`notifications.patch.ts` 与按 `[thread_id]` 的标记已读、`subject-states.post.ts`
- `pulls.get.ts`、`pulls/[owner]/[repo]/[pull_number]` 及 `comments`、`files`、`reviewers`（含 `candidates`）、`timeline`
- `repos.get.ts` 及仓库子资源：`branches`、`contents`（含 `[...path]`）、`default-branch`、`labels`、`license`、`permissions`、`readme`、`raw/[...path]`、`star`、`subscription`、`pull-for-branch`、`pulls` 下的 `checks` / `commits` / `review-threads` / `reviewers` / `reviews`
- `search/issues.get.ts` — GitHub 搜索代理
- `settings.get.ts` / `settings.put.ts` — 用户设置读写
- `user.get.ts` — 当前用户

### server/routes/ — 非 API 路由

页面级路由与认证流程端点：

- `auth/pat.post.ts` — token 登录
- `auth/github.get.ts` — GitHub OAuth 回调
- `auth/unlock.post.ts` — 个人模式解锁
- `auth/logout.post.ts` — 登出
- `__nekogit/health.get.ts` — 健康检查（桌面端探活使用）

### server/utils/ — 共享服务端工具

- GitHub 认证：`github-auth-utils.ts`、`auth-providers.ts`、`auth-session-utils.ts`、`auth-rate-limit-utils.ts`
- 资源组装：`github-timeline-utils.ts`、`github-discussion-utils.ts`、`ci-checks-utils.ts`、`pr-actions-utils.ts`、`pr-commits-utils.ts`、`pr-reviewers-utils.ts`、`repo-route-utils.ts`、`repo-contents-utils.ts`
- 代理与缓存：`github-proxy-utils.ts`、`api-cache-utils.ts`、`github-pagination.ts`
- CSRF：`csrf-utils.ts`、`csrf-cookie-utils.ts`
- 用户设置：`user-settings-utils.ts`、`user-settings-storage-utils.ts`
- 个人模式：`personal-mode-utils.ts`；其他：`time-utils.ts`

### server/middleware/ + server/plugins/

- `middleware/csrf.ts` — 非 GET 请求的 CSRF 校验
- `middleware/api-cache-control.ts` — API 缓存头控制
- `plugins/csrf.ts` — 注入 CSRF cookie/token
- `plugins/personal-mode.ts` — 个人模式初始化
- `plugins/personal-mode-validate-secret.ts` — 个人模式密钥校验

## 共享层 (shared/)

前后端都可引用的共享代码（通过 Nuxt alias 与 tsconfig 暴露）：

- `types/` — 类型定义：`auth-provider.ts`、`auth.d.ts`、`custom-search.ts`、`dashboard.ts`、`discussions.ts`、`notifications.ts`、`tab-groups.ts`、`user-settings.ts`
- `utils/` — 跨端工具：`csrf-protection.ts`（CSRF 生成/校验）、`proxy-url.ts`（代理 URL 构造）、`auth-rate-limit.ts` / `auth-client-ip.ts`（速率限制与客户端 IP）、`auth-session-env.ts` / `personal-mode-env.ts`（环境变量解析）、`user-settings.ts` / `user-settings-storage-env.ts`（设置存储）、`desktop-readiness.ts`、`github-notification-threads.ts`、`github-search-query.ts`、`raw-content-type.ts`

## 桌面客户端 (src-tauri/)

Rust/Tauri 桌面客户端（Linux 打包为 `.deb`）。关键配置：

- `tauri.conf.json` — 应用标识、CSP、构建命令（`beforeBuildCommand`/`beforeDevCommand` 调用 `scripts/run-tauri-nuxt.mjs`）、bundle 配置（deb 目标、`linux/deb/postinst` 等脚本、打包 `.node-runtime/` 与 `.output/`）
- `capabilities/default.json` — 前端能力声明
- `permissions/autogenerated/commands/*.toml` — 每个 Tauri 命令的自动生成权限（命令名稳定，前端类型化包装与注册都依赖它们）
- `Cargo.toml` / `build.rs` / `icons/` / `linux/`（desktop 模板与 deb 钩子脚本）
- `src/main.rs` — 入口（调用 `lib.rs`）

### src-tauri/src/ — Rust 模块

`lib.rs` 是唯一入口，负责 Tauri 启动/setup、插件注册、窗口创建、应用状态与命令注册。其余模块按职责拆分：

| 模块 | 职责 |
|------|------|
| `desktop_commands/` | Tauri 命令处理器与命令到领域层的桥接。`runtime.rs`（运行时/服务/自启动/日志命令）、`github.rs`（GitHub URL 与 CLI token）、`local_repository/`（按 clone/read/sync/branch/change/open 命令族拆分）、`window_menu.rs`（菜单/窗口/托盘状态） |
| `desktop_runtime/` | 运行时元数据与诊断：`types.rs`（运行时状态、前端 DTO、未托管服务回退）、`paths.rs`（数据目录解析）、`diagnostics.rs`（诊断报告） |
| `desktop_server/` | 内置 Nuxt/Nitro 服务生命周期：`paths.rs`、`config.rs`、`log.rs`、`process.rs`（启动/健康检查/重启/崩溃监控）、`types.rs`、`lifecycle.rs`（公共 spawn/restart API） |
| `desktop_window/` | 主窗口行为：`constants.rs`、`visibility.rs`、`title.rs`、`navigation.rs`（GitHub 启动导航与 webview 导航拦截） |
| `desktop_instance/` | 单实例生命周期：`lock.rs`（实例锁文件）、`args.rs`（隐藏启动参数）、`activation.rs`（激活端口、二次实例交接）、`types.rs`、`lifecycle.rs` |
| `desktop_menu/` | 菜单构建：`ids.rs`、`accelerators.rs`、`items.rs`、`state.rs`、`app/`（File/Navigate/Review/View/Help 分组）、`tray.rs` |
| `desktop_menu_actions/` | 菜单项执行：`mod.rs`（稳定入口 `handle_menu_event`）、`window.rs`、`frontend.rs`（菜单到前端事件）、`system.rs`（数据/日志打开、外部 GitHub、服务重启） |
| `desktop_url/` | URL 安全与路由契约：`github.rs`（GitHub URL 白名单与 dashboard 目标判定）、`deep_link.rs`（`nekogit://open` 解析）、`activation.rs`、`dashboard.rs` |
| `desktop_events/` | 前端可见的事件契约：`names.rs`、`payloads.rs`、`emit.rs`（类型化 emit） |
| `desktop_tray.rs` / `desktop_autostart.rs` | 托盘（图标、未读徽标、tooltip）；Linux 自启动（`.desktop` 条目生成） |
| `desktop_github_cli.rs` / `desktop_open.rs` / `desktop_session.rs` | `gh auth token` 读取；原生打开（URL/文件/终端）；会话密钥解析（`NUXT_SESSION_PASSWORD`、生成回退、受限权限的密钥文件写入） |
| `desktop_window_state/` | 持久化窗口位置/最大化：`constants.rs`、`validation.rs`、`store.rs`、`capture.rs` |
| `local_repository/` | **本地 Git 与文件系统安全层**。路径校验统一放在 `paths/`。子模块：`read/`（只读：status、branch、changed-files、commit）、`diff/`（diff 生成、pathspec、截断、未跟踪预览）、`parse/`（纯 Git 输出解析；`parse/status/` 细分 porcelain 状态/冲突/计数）、`write/`（写操作：clone、sync、branch、change）、`storage/`（记住的本地仓库 JSON 索引）、`url/`（克隆 URL 规范化与目标推导）、`types.rs` |

模块边界详见 `docs/project-handoff.md` 的 Ownership Boundaries 一节与 `docs/desktop-git-workflow.md`。

## 测试 (tests/)

Vitest 单元测试，按被测对象命名。覆盖：认证（`auth-client-ip`、`auth-rate-limit`、`auth-session-env`、`personal-mode-env`）、CSRF（`csrf-utils`、`csrf-cookie-utils`）、GitHub 代理与搜索（`github-proxy-utils`、`github-search-query`、`github-notification-threads`）、前端工具（`repo-file-content-utils`、`repo-file-tree-utils`、`github-url-parsing`、`keyboard-shortcut-utils`、`desktop-window-title-utils`、`desktop-notification-utils`、`pr-review-workspace-state-utils`）、服务端工具（`ci-checks-utils`、`pr-actions-utils`、`pr-commits-utils`）、设置存储（`user-settings`）、`desktop-readiness`、`raw-content-type`、`file-download-utils`、`current-github-url-utils` 等。Rust 侧的单元测试紧邻各模块（如 `desktop_runtime/diagnostics.rs`、`local_repository/parse/*`、`desktop_window/title.rs`）。

## 关键数据流

1. **Web 前端 → 服务端 → GitHub**：前端 composable 通过 `useNekoGitApiFetch`（携带 CSRF）调用 `server/api/` 端点；服务端从加密会话 cookie 中取出 token，用 `github-proxy-utils` 代理到 GitHub API 后返回。token 不落库，不直达浏览器存储。
2. **认证**：多用户模式支持 PAT 登录（`auth/pat.post.ts`）或 OAuth（`auth/github.get.ts`）；单用户自托管可用个人模式（`auth/unlock.post.ts`，密码锁 + “记住此设备”）。会话密钥来自 `NUXT_SESSION_PASSWORD`（桌面端由 `desktop_session.rs` 生成持久密钥）。
3. **桌面端**：Tauri 启动时经 `desktop_server` 在 `127.0.0.1` 拉起内置 Nitro 服务，打开 webview 指向该地址；前端通过 `composables/desktop-runtime/` 的类型化包装调用 Tauri `invoke()`（Rust 侧在 `desktop_commands/` 处理）。本地仓库 Git 操作全部在 Rust `local_repository/` 完成，Vue 组件只消费视图模型。
4. **单实例与 URL 跳转**：二次启动通过 `desktop_instance` 激活已有窗口；`nekogit://open` 深链经 `desktop_url/deep_link.rs` 校验后导航到对应 GitHub 目标。

## 常用命令

在仓库根目录使用 pnpm（`.npmrc` 已固定 npmmirror registry）：

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 启动 Nuxt 开发服务器（Web 模式） |
| `pnpm build` | 构建 Nuxt 生产输出（`.output/`） |
| `pnpm client:dev` | Tauri 桌面开发模式（自动拉起本地 Nuxt） |
| `pnpm client:build` | 构建 Linux `.deb`（产物在 `src-tauri/target/release/bundle/deb/`） |
| `pnpm client:release-linux` | 构建并打包 Linux 发布包 |
| `pnpm test` | 运行 Vitest 单元测试 |
| `pnpm typecheck` | Nuxt + vue-tsc 类型检查 |
| `pnpm lint` / `pnpm lint:fix` | oxlint 检查 / 自动修复 |
| `pnpm fmt` / `pnpm fmt:check` | oxfmt 格式化 / 检查 |

Rust 侧（在 `src-tauri/` 目录或指定 manifest）：`cargo check`、`cargo test`、`cargo clippy --all-targets -- -D warnings`、`cargo fmt --check`。完整验证清单见 `docs/project-handoff.md`。
