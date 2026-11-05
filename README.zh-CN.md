# NekoGit — GitHub 工作仪表盘

在一个集中的工作区中追踪通知、Issue、Pull Request 和仓库活动。不用频繁切换标签页，没有噪音。

![AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0-blue) ![Nuxt 4](https://img.shields.io/badge/Nuxt-4-00DC82?logo=nuxt) ![pnpm](https://img.shields.io/badge/pnpm-11-F69220?logo=pnpm)

---

## 功能

### 📬 通知

通过原因图标快速识别 `mention`、`review_requested`、`ci_activity`、`security_alert`、`assign`、`state_change`、`subscribed` 等通知。未读项有蓝色标记。点击 **标记已读** 即可消除，或让 60 秒自动刷新捕获新通知，无需重载页面。

### 🎯 Issue 与 Pull Request

基于搜索的列表，支持快速筛选（open / closed / merged）。点击任意行打开 **侧滑详情面板**，显示完整时间线、标签、负责人和操作按钮——无需页面跳转。

### ✨ 自定义标签页

创建基于 **真实 GitHub 搜索查询** 的无限标签页。将任意 GitHub 搜索限定符粘贴到标签编辑器中即可。拖拽排序，将标签页归入文件夹分组。

### 🖨 Markdown + 图表

评论渲染为丰富 Markdown，代码块带语法高亮，以及 **Mermaid 图表**——时序图、流程图、甘特图——内嵌在原本的位置。

### 🌐 国际化

内置英文和简体中文，根据浏览器自动检测。

### 🌙 深色模式

自适应深色模式样式，在低光环境下保持仪表盘舒适可读，并与系统主题保持一致。

### 📂 仓库

分页展示你的仓库列表，每个仓库有快速链接。在不离开仪表盘的情况下快速跳转到项目。

---

## 为什么用 NekoGit？

GitHub 原生界面让你在标签页、页面和仓库之间来回跳转。NekoGit 将所有内容整合到 **一个单页工作区**：

|                   | GitHub.com                 | NekoGit                      |
| ----------------- | -------------------------- | ---------------------------- |
| 通知 + Issue + PR | 分散在多个页面，来回跳转   | 一个仪表盘，四个标签页       |
| 自定义保存的搜索  | 书签或 URL 拼凑            | 自带标签页管理，支持拖拽排序 |
| 界面专注度        | 导航栏、项目面板、侧栏干扰 | 只显示你关心的 GitHub 活动   |

---

## 快速开始

运行环境使用 **pnpm**。仓库内置 `.npmrc`，pnpm 会使用 npmmirror 国内源。启动开发服务器：

```bash
pnpm install
pnpm dev
```

打开终端显示的 URL，在登录页面粘贴你的 GitHub token。

> 要获取 token，运行 `gh auth token`——该 token 继承你授予 GitHub CLI 的权限，通常包含组织级别的访问权限。

## 项目文档

维护和交接请先看 [docs/README.md](docs/README.md)。项目交接文档集中记录了当前运行方式、发布检查清单、模块边界和下一阶段优先级。

## Linux 桌面客户端（Rust/Tauri）

仓库包含一个 Rust/Tauri 桌面客户端，位于 `src-tauri`。开发模式会自动启动本地 Nuxt 服务：

```bash
pnpm install
pnpm client:dev
```

构建 Debian 安装包：

```bash
pnpm client:build
```

生成文件位于 `src-tauri/target/release/bundle/deb/`。Release 会打包 Nuxt/Nitro 输出和 Linux x64 Node 运行时，并在打开 Tauri WebView 前启动 `127.0.0.1` 本地服务。当前 Linux `.deb` 包依赖 Tauri 自动生成的 GTK/WebKit/appindicator 运行库，以及内置 Node 二进制需要的共享库；除非用 `NEKOGIT_NODE_PATH` 覆盖运行时，否则不再需要系统 `nodejs`。

桌面客户端会把运行状态保存在 Tauri 应用数据目录中。首次启动会生成持久化的 `session.secret`，WebView 数据位于 `webview/`，内置服务日志写入 `logs/nekogit-server.log`，并可通过原生菜单 **File → Open Data Directory** / **File → Open Server Log** 打开。关闭主窗口会隐藏到系统托盘；需要真正退出时使用托盘菜单或 **File → Quit**。NekoGit 已运行时再次打开，会唤起现有窗口，而不是启动第二套内置服务。

常用桌面快捷键包括：`F5` 刷新当前 NekoGit 视图，`Ctrl+,` 打开设置，`Alt+Left` / `Alt+Right` 执行应用内前进后退，`Ctrl+Shift+G` / `Ctrl+Shift+O` / `Ctrl+Shift+L` 分别用于打开当前 GitHub 页面、打开剪贴板 GitHub 链接、复制当前 GitHub 链接。

安装后的 Linux 包会把 `nekogit://` 注册为桌面 URL 处理器。例如，`nekogit://open?url=https%3A%2F%2Fgithub.com%2Fowner%2Frepo%2Fissues%2F42` 会在正在运行的 NekoGit 窗口中打开对应 GitHub 目标；客户端只接受通过校验的 GitHub HTTPS URL。

如需改为连接外部/自托管实例，启动客户端前设置：

```bash
NEKOGIT_CLIENT_URL=http://127.0.0.1:3000
```

如需在打包时固定内置 Node 版本：

```bash
NEKOGIT_NODE_RUNTIME_VERSION=26.2.0 pnpm client:build
```

---

## 在线试用

访问 **[nekogit.euphony.ink](https://nekogit.euphony.ink)**——一个运行在非个人模式下的官方演示站点。粘贴 GitHub token 或通过 OAuth 登录即可立即体验。

---

## 自部署

NekoGit 有两种部署模式，通过环境变量控制。至少启用一种模式，否则应用拒绝启动。

### 非个人模式（多用户）

用户通过粘贴 GitHub token 或 GitHub OAuth 登录。适用于团队或托管部署。

| 环境变量                          | 必填              | 默认值 | 说明                           |
| --------------------------------- | ----------------- | ------ | ------------------------------ |
| `NUXT_SESSION_PASSWORD`           | **是**            | —      | 32 字节 hex 密钥，用于会话加密 |
| `NUXT_AUTH_PAT_ENABLED`           | 否                | `true` | 允许 token 登录                |
| `NUXT_AUTH_GITHUB_OAUTH_ENABLED`  | 否                | —      | 允许 OAuth 登录                |
| `NUXT_OAUTH_GITHUB_CLIENT_ID`     | 启用 OAuth 时必填 | —      | GitHub OAuth 应用的 Client ID  |
| `NUXT_OAUTH_GITHUB_CLIENT_SECRET` | 启用 OAuth 时必填 | —      | GitHub OAuth 应用的 Secret     |

### 个人模式（单用户，自托管）

密码保护的安全柜，内含预先配置好的 token。每次打开新浏览器都会看到锁屏；可选勾选"记住此设备"保持登录状态。

| 环境变量                                     | 必填   | 默认值  | 说明                           |
| -------------------------------------------- | ------ | ------- | ------------------------------ |
| `NUXT_AUTH_PERSONAL_MODE_ENABLED`            | **是** | `false` | 启用个人模式                   |
| `NUXT_GIT_PULSE_AUTH_GITHUB_TOKEN`           | **是** | —       | 内置于服务器的 GitHub token    |
| `NUXT_GIT_PULSE_AUTH_PERSONAL_PASSWORD`      | **是** | —       | 锁屏密码                       |
| `NUXT_GIT_PULSE_AUTH_PERSONAL_COOKIE_SECRET` | **是** | —       | 用于签名"记住我" cookie 的密钥 |

### 用户设置存储

仪表盘用户设置（包括字体选择、视图分组和自定义搜索标签页）通过服务端用户设置存储层持久化。本地文件系统后端使用名为 `userSettings` 的 Nitro storage mount；Upstash 后端使用 Redis adapter。这与 GitHub token / session 存储相互独立。

默认情况下，NekoGit 使用本地文件系统路径 `./.data/user-settings`，该目录已被 git 忽略。生产部署，尤其是 serverless、容器或多实例部署，应将该 mount 配置为持久化存储。

| 环境变量                                                | 必填    | 默认值               | 说明                                                                                                                  |
| ------------------------------------------------------- | ------- | -------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `NUXT_NEKOGIT_USER_SETTINGS_STORAGE_DRIVER`             | 否      | `fs`                 | 用户设置存储后端。`fs` 使用本地 Nitro storage，Upstash Redis 使用 `upstash`。                                         |
| `NUXT_NEKOGIT_USER_SETTINGS_STORAGE_BASE`               | 否      | 按 driver 决定       | base 路径或命名空间。`fs` 默认 `./.data/user-settings`，`upstash` 默认 `nekogit:user-settings`。                      |
| `NUXT_NEKOGIT_USER_SETTINGS_STORAGE_UPSTASH_ENV_PREFIX` | 否      | `UPSTASH_REDIS_REST` | 可选的 Vercel Storage 自定义环境变量前缀。NekoGit 会读取 `<prefix>_KV_REST_API_URL` 和 `<prefix>_KV_REST_API_TOKEN`。 |
| `UPSTASH_REDIS_REST_URL`                                | Upstash | —                    | Upstash Redis REST URL，可由 Vercel Upstash 集成或 Upstash 控制台提供。                                               |
| `UPSTASH_REDIS_REST_TOKEN`                              | Upstash | —                    | Upstash Redis REST token，可由 Vercel Upstash 集成或 Upstash 控制台提供。                                             |

使用标准变量时，Vercel + Upstash Redis 可配置为：

```env
NUXT_NEKOGIT_USER_SETTINGS_STORAGE_DRIVER=upstash
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```

如果 Vercel 生成的是 `UPSTASH_REDIS_REST_KV_REST_API_URL` 和 `UPSTASH_REDIS_REST_KV_REST_API_TOKEN` 这类自定义前缀变量，可配置为：

```env
NUXT_NEKOGIT_USER_SETTINGS_STORAGE_DRIVER=upstash
NUXT_NEKOGIT_USER_SETTINGS_STORAGE_UPSTASH_ENV_PREFIX=UPSTASH_REDIS_REST
```

请使用以 `_KV_REST_API_TOKEN` 结尾的读写 token；`_KV_REST_API_READ_ONLY_TOKEN` 无法保存用户设置。

---

## 常见问题

### NekoGit 会存储我的 token 吗？

不会。你的 token 保存在加密的服务端会话 cookie 中——永远不会写入数据库。持久化的 PAT / OAuth 登录最长可保留约 30 天（直到你主动退出或 cookie 被清除），并不会在关闭浏览器时立即结束。

### 如何退出登录？

点击左侧活动栏中的头像 → **退出登录**。你的会话 cookie 会被清除。

---

## 许可证

GNU Affero General Public License v3.0 — 详见 [LICENSE](LICENSE)。
