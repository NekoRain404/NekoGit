# NekoGit — GitHub Work Dashboard

Track notifications, issues, pull requests, and repositories from one focused workspace. No tab-switching, no noise.

![AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0-blue) ![Nuxt 4](https://img.shields.io/badge/Nuxt-4-00DC82?logo=nuxt) ![pnpm](https://img.shields.io/badge/pnpm-11-F69220?logo=pnpm)

---

## Features

### 📬 Notifications

Reason icons for `mention`, `review_requested`, `ci_activity`, `security_alert`, `assign`, `state_change`, `subscribed` and more make activity easy to scan. Unread items have a blue indicator. Click **Mark as read** to dismiss, or let the 60-second auto-refresh catch new ones without reloading the page.

### 🎯 Issues & Pull Requests

Search-backed lists with quick filters (open / closed / merged). Click any row to open a **slide-over detail panel** showing the full timeline, labels, assignees, and action buttons — no page navigation needed.

### ✨ Custom Tabs

Create unlimited tabs backed by **real GitHub search queries**. Paste any GitHub search qualifier into the tab editor — it just works. Drag-and-drop to reorder, group tabs into named folders.

### 🖨 Markdown + Diagrams

Comments render with rich Markdown, syntax-highlighted code blocks, and **Mermaid diagrams** — sequence charts, flowcharts, Gantt — inline where they belong.

### 🌐 i18n

Built-in English and Simplified Chinese, auto-detected from your browser.

### 🌙 Dark Mode

Adaptive dark mode styling keeps the dashboard comfortable in low-light environments and aligned with the system theme.

### 📂 Repositories

Paginated list of your repos with quick links to each. Create personal or organization repositories, edit descriptions and homepages, transfer a repository to another owner, archive or unarchive it, and delete it from the detail view with a typed-name confirmation.

---

## Why NekoGit?

GitHub's own interface has you bouncing between tabs, pages, and repos to stay on top of everything. NekoGit brings it all into **one single-page workspace**:

|                              | GitHub.com                            | NekoGit                                 |
| ---------------------------- | ------------------------------------- | --------------------------------------- |
| Notifications + Issues + PRs | Separate pages, lots of back/forth    | One dashboard, four tabs                |
| Custom saved searches        | Bookmarks or URL hacks                | Built-in tab manager with drag-and-drop |
| Interface focus              | Nav bar, project panel, sidebar noise | Only the GitHub activity you care about |

---

## Quick Start

Runtime uses **pnpm**. This repository includes an `.npmrc` that points pnpm at the npmmirror registry. Start the dev server:

```bash
pnpm install
pnpm dev
```

Open the URL shown in terminal and paste your GitHub token on the landing page.

> To get a token, run `gh auth token` — the token inherits the permissions you granted to the GitHub CLI, which typically includes organization-level access.

## Project Documentation

For maintenance and handoff, start with [docs/README.md](docs/README.md). The
project handoff notes collect the current runbook, release checklist, module
boundaries, and next-stage priorities.

## Linux Desktop Client (Rust/Tauri)

This repository includes a Rust/Tauri desktop client in `src-tauri`. Development mode starts the local Nuxt server automatically:

```bash
pnpm install
pnpm client:dev
```

Build a Debian package:

```bash
pnpm client:build
```

The package is written to `src-tauri/target/release/bundle/deb/`. Release builds bundle the Nuxt/Nitro output and a Linux x64 Node runtime, then start the server on `127.0.0.1` before opening the Tauri webview. The current Linux `.deb` package relies on Tauri's generated GTK/WebKit/appindicator runtime dependencies plus the shared libraries required by the bundled Node binary; it does not require system `nodejs` unless you override the runtime with `NEKOGIT_NODE_PATH`.

The desktop client keeps its runtime state in the Tauri app data directory. It generates a persistent `session.secret` on first launch, stores webview data under `webview/`, writes the bundled server log to `logs/nekogit-server.log`, and exposes **File → Open Data Directory** / **File → Open Server Log** from the native menu. Closing the main window hides NekoGit to the system tray; use the tray menu or **File → Quit** to exit the bundled server. Reopening NekoGit while it is already running focuses the existing window instead of starting a second bundled server.

The repository sidebar can clone or adopt an existing checkout, fetch, pull, push/publish, rebase, stage files individually, expand changed-file and commit-history lists, stash/apply/pop entries, amend the last commit, and undo a local commit while keeping its changes staged.

Common desktop shortcuts include `F5` for refreshing the current NekoGit view, `Ctrl+,` for settings, `Alt+Left` / `Alt+Right` for in-app navigation, and `Ctrl+Shift+G` / `Ctrl+Shift+O` / `Ctrl+Shift+L` for opening, opening from clipboard, or copying GitHub URLs.

Installed Linux packages register `nekogit://` as a desktop URL handler. For example, `nekogit://open?url=https%3A%2F%2Fgithub.com%2Fowner%2Frepo%2Fissues%2F42` opens the matching GitHub target inside the running NekoGit window; only validated GitHub HTTPS URLs are accepted.

To smoke-test the real desktop webview on Linux, build the app once and run the WebDriver-based landing check:

```bash
pnpm build
cargo build --manifest-path src-tauri/Cargo.toml
cargo install tauri-driver
sudo apt-get install webkit2gtk-driver xvfb
pnpm smoke:desktop
```

The script starts the built Nitro server, launches the Tauri client under `xvfb-run`, drives it through `tauri-driver`, and verifies the landing page renders. Set `NEKOGIT_DESKTOP_BINARY`, `NEKOGIT_TAURI_DRIVER`, or `NEKOGIT_WEBKIT_DRIVER` when the binaries live elsewhere. A manual CI run (`gh workflow run ci.yml`) also executes the same desktop check on Ubuntu.

To point the client at an external/self-hosted instance instead, set:

```bash
NEKOGIT_CLIENT_URL=http://127.0.0.1:3000
```

To pin the bundled Node runtime during packaging, set:

```bash
NEKOGIT_NODE_RUNTIME_VERSION=26.2.0 pnpm client:build
```

---

## Try It Online

Visit **[nekogit.euphony.ink](https://nekogit.euphony.ink)** — an official demo running in non-personal mode. Paste a GitHub token or sign in with OAuth to try the dashboard instantly.

---

## Self-hosting

NekoGit has two deployment modes, controlled by environment variables. At least one must be enabled, or the app refuses to start.

### Non-personal Mode (multi-user)

Users sign in by pasting a GitHub token or via GitHub OAuth. Suitable for teams or hosted deployments.

| Environment Variable              | Required | Default | Description                            |
| --------------------------------- | -------- | ------- | -------------------------------------- |
| `NUXT_SESSION_PASSWORD`           | **Yes**  | —       | 32-byte hex key for session encryption |
| `NUXT_AUTH_PAT_ENABLED`           | No       | `true`  | Allow token-based login                |
| `NUXT_AUTH_GITHUB_OAUTH_ENABLED`  | No       | —       | Allow OAuth login                      |
| `NUXT_OAUTH_GITHUB_CLIENT_ID`     | If OAuth | —       | GitHub OAuth app client ID             |
| `NUXT_OAUTH_GITHUB_CLIENT_SECRET` | If OAuth | —       | GitHub OAuth app secret                |

### Personal Mode (single-user, self-hosted)

A password-gated vault with a pre-configured token. On each new browser you see a lock screen; optionally tick "Remember this device" to stay logged in.

| Environment Variable                         | Required | Default | Description                              |
| -------------------------------------------- | -------- | ------- | ---------------------------------------- |
| `NUXT_AUTH_PERSONAL_MODE_ENABLED`            | **Yes**  | `false` | Enable personal mode                     |
| `NUXT_GIT_PULSE_AUTH_GITHUB_TOKEN`           | **Yes**  | —       | GitHub token baked into the server       |
| `NUXT_GIT_PULSE_AUTH_PERSONAL_PASSWORD`      | **Yes**  | —       | Lock-screen password                     |
| `NUXT_GIT_PULSE_AUTH_PERSONAL_COOKIE_SECRET` | **Yes**  | —       | Secret for signing "remember me" cookies |

### User Settings Storage

Dashboard user settings, including font choices, tab groups, and custom search tabs, are persisted through the server user settings storage layer. The local filesystem backend uses the Nitro storage mount named `userSettings`; the Upstash backend uses a Redis adapter. This is separate from GitHub token/session storage.

By default NekoGit uses local filesystem storage at `./.data/user-settings`, which is ignored by git. For production deployments, especially serverless, container, or multi-instance deployments, configure this mount to use durable storage.

| Environment Variable                                    | Required | Default              | Description                                                                                                           |
| ------------------------------------------------------- | -------- | -------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `NUXT_NEKOGIT_USER_SETTINGS_STORAGE_DRIVER`             | No       | `fs`                 | User settings storage backend. Use `fs` for local Nitro storage or `upstash` for Upstash Redis.                       |
| `NUXT_NEKOGIT_USER_SETTINGS_STORAGE_BASE`               | No       | Driver-specific      | Base path/namespace. Defaults to `./.data/user-settings` for `fs` and `nekogit:user-settings` for `upstash`.          |
| `NUXT_NEKOGIT_USER_SETTINGS_STORAGE_UPSTASH_ENV_PREFIX` | No       | `UPSTASH_REDIS_REST` | Optional Vercel Storage custom env prefix. NekoGit reads `<prefix>_KV_REST_API_URL` and `<prefix>_KV_REST_API_TOKEN`. |
| `UPSTASH_REDIS_REST_URL`                                | Upstash  | —                    | Upstash Redis REST URL, supplied by the Vercel Upstash integration or Upstash dashboard.                              |
| `UPSTASH_REDIS_REST_TOKEN`                              | Upstash  | —                    | Upstash Redis REST token, supplied by the Vercel Upstash integration or Upstash dashboard.                            |

For Vercel + Upstash Redis using the standard variables, set:

```env
NUXT_NEKOGIT_USER_SETTINGS_STORAGE_DRIVER=upstash
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```

If Vercel generated custom-prefixed variables such as `UPSTASH_REDIS_REST_KV_REST_API_URL` and `UPSTASH_REDIS_REST_KV_REST_API_TOKEN`, set:

```env
NUXT_NEKOGIT_USER_SETTINGS_STORAGE_DRIVER=upstash
NUXT_NEKOGIT_USER_SETTINGS_STORAGE_UPSTASH_ENV_PREFIX=UPSTASH_REDIS_REST
```

Use the read/write token variable ending in `_KV_REST_API_TOKEN`; the `_KV_REST_API_READ_ONLY_TOKEN` value cannot save user settings.

---

## FAQ

### Does NekoGit store my token?

No. Your token is kept in an encrypted server session cookie — it never touches a database. Persistent PAT and OAuth logins last up to 30 days (or until you log out or the cookie is cleared), not only until the browser closes.

### How do I log out?

Click your avatar in the left activity bar → **Logout**. Your session cookie is cleared.

---

## License

GNU Affero General Public License v3.0 — see [LICENSE](LICENSE).
