# Project Handoff

This document is the first stop for maintaining NekoGit after the current
desktop-client consolidation work.

> The 2026-11-04 code audit is tracked in
> [docs/audit/2026-11-04-code-audit.md](audit/2026-11-04-code-audit.md). It
> includes defect IDs, missing-feature inventory, and the remediation checklist.

## Current Scope

NekoGit is now organized as a Nuxt 4 GitHub dashboard plus a Rust/Tauri Linux
desktop client.

Delivered user-facing areas:

- Web dashboard for GitHub notifications, Issues, Pull Requests, repositories,
  custom search tabs, settings, Markdown, and Mermaid rendering.
- Linux desktop client that starts the bundled Nuxt/Nitro server, opens the
  Tauri webview, manages tray/window lifecycle, exposes native menus, and
  registers the `nekogit://` URL handler.
- Local repository workflow in the repository detail panel: clone, open local
  repo, open terminal, fetch, pull, branch switch/create, remote checkout,
  commit, stash, push, changed files, text diff preview, and recent commit
  history.

## Daily Runbook

Use pnpm from the workspace root. The checked-in `.npmrc` pins the registry to:

```text
https://registry.npmmirror.com
```

Install and run the web app:

```bash
pnpm install
pnpm dev
```

By default, development mode uses token login (`NUXT_AUTH_PAT_ENABLED=true`) and
does not enable personal mode. Personal mode must be enabled explicitly with
`NUXT_AUTH_PERSONAL_MODE_ENABLED=true` plus
`NUXT_GIT_PULSE_AUTH_GITHUB_TOKEN`,
`NUXT_GIT_PULSE_AUTH_PERSONAL_PASSWORD`, and
`NUXT_GIT_PULSE_AUTH_PERSONAL_COOKIE_SECRET`.

Run the desktop client in development mode:

```bash
pnpm client:dev
```

Build the Linux `.deb` package:

```bash
pnpm client:build
```

The release artifact is written to:

```text
src-tauri/target/release/bundle/deb/
```

The current expected package name is:

```text
NekoGit_0.1.0_amd64.deb
```

## Verification Checklist

Run these before handoff or release:

```bash
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo check --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
pnpm fmt:check
pnpm typecheck
pnpm lint
pnpm test
pnpm check:tauri-commands
pnpm client:build
```

Use `pnpm build` when validating the web-only deployment path.

## Ownership Boundaries

- `app/components/` owns Vue presentation. Page/detail components should compose
  focused feature components instead of accumulating workflow logic.
- `app/composables/` owns frontend stateful workflows and typed desktop command
  access. View components should not call Tauri `invoke()` directly.
  `useDesktopRuntime.ts` owns shared desktop runtime state and the stable
  frontend-facing composable; `app/composables/desktop-runtime/` owns Tauri
  invoke safety, command wrappers, local-repository command wrappers, and
  frontend DTO types.
  `useLocalRepositoryPanel.ts` owns local-repository workflow orchestration,
  while `app/composables/local-repository-panel/` owns panel-specific state,
  read-side refreshers, view-model derivation, dialog helpers, and shared
  types.
- `app/utils/` owns pure frontend helpers with tests when behavior is
  non-trivial. File-browser content decoding, size formatting, extension
  parsing, and syntax-language mapping live in `repo-file-content-utils.ts`
  instead of `RepoFileView.vue`.
- `server/api/`, `server/routes/`, `server/middleware/`, and `server/plugins/`
  own Nuxt/Nitro HTTP behavior and authentication boundaries.
- `server/utils/` and `shared/` own reusable server/shared contracts.
- `src-tauri/src/lib.rs` owns Tauri bootstrap/setup, plugin registration,
  window creation orchestration, app state registration, and command
  registration.
- `src-tauri/src/desktop_commands/` owns Tauri command handlers and the
  command-to-domain bridge. Keep command names stable because frontend typed
  wrappers, generated permissions, and Tauri registration depend on them.
  `runtime.rs` owns runtime/server/autostart/open-log commands, `github.rs`
  owns GitHub URL and GitHub CLI token commands, `local_repository/` owns local
  Git commands by clone/read/sync/branch/change/open command families, and
  `window_menu.rs` owns menu/window/tray state commands.
- `src-tauri/src/desktop_instance/` owns the desktop single-instance lifecycle.
  `lock.rs` owns instance lock files, `args.rs` owns hidden-start argument
  detection, `activation.rs` owns activation port parsing, secondary instance
  handoff, and local activation listener handling, `types.rs` owns instance
  handles and callback contracts, and `lifecycle.rs` owns the public
  claim-or-activate flow.
- `src-tauri/src/desktop_menu/` owns desktop menu contracts and construction.
  `ids.rs` owns menu item IDs, `accelerators.rs` owns keyboard shortcuts,
  `items.rs` owns menu handles and frontend-facing menu state DTOs, `state.rs`
  owns enabled-state update helpers, `app/` owns app menu construction by
  File/Navigate/Review/View/Help groups, and `tray.rs` owns tray menu
  construction.
- `src-tauri/src/desktop_menu_actions/` owns menu item execution. `mod.rs`
  keeps the stable `handle_menu_event` entrypoint, `window.rs` owns window
  visibility/reload/quit actions, `frontend.rs` owns menu-to-frontend event
  emission, and `system.rs` owns app data/log opening, GitHub external open,
  and bundled server restart.
- `src-tauri/src/desktop_tray.rs` owns tray icon creation, tray click behavior,
  unread badge normalization, and tray tooltip updates.
- `src-tauri/src/desktop_window/` owns main-window behavior. `constants.rs`
  owns the main window label and default dimensions, `visibility.rs` owns
  show/hide/focus helpers, `title.rs` owns title normalization and title tests,
  and `navigation.rs` owns GitHub launch navigation plus webview
  navigation/new-window interception.
- `src-tauri/src/desktop_url/` owns desktop URL safety and routing contracts.
  `github.rs` owns GitHub URL allow-listing and dashboard-target detection,
  `deep_link.rs` owns `nekogit://open` parsing, `activation.rs` owns launch
  arguments and single-instance activation messages, and `dashboard.rs` owns
  Dashboard navigation URL construction.
- `src-tauri/src/desktop_autostart.rs` owns Linux desktop autostart status,
  `.desktop` entry generation, and enable/disable file operations.
- `src-tauri/src/desktop_events/` owns frontend-facing desktop event contracts.
  `names.rs` owns event name constants aligned with the frontend listener
  plugins, `payloads.rs` owns serialized command/navigation payloads and their
  contract tests, and `emit.rs` owns typed Tauri emit helpers used by menus and
  tray actions.
- `src-tauri/src/desktop_github_cli.rs` owns GitHub CLI token reads,
  `gh auth token` process handling, retry timing, and token output
  normalization.
- `src-tauri/src/desktop_open.rs` owns native open operations for external
  URLs, files/directories, terminal launch, and same-origin URL checks.
- `src-tauri/src/desktop_runtime/` owns desktop runtime metadata and
  diagnostics. `types.rs` owns the runtime state, frontend-facing runtime DTO,
  and unmanaged server fallback status, `paths.rs` owns app data directory
  resolution and path display conversion, and `diagnostics.rs` owns diagnostics
  report formatting and redaction-oriented tests.
- `src-tauri/src/desktop_server/` owns bundled Nuxt/Nitro server lifecycle.
  `paths.rs` owns Node/server entry discovery, external client URL handling,
  local ports, and log paths. `config.rs` owns inherited environment and server
  config. `log.rs` owns server log handles and client log lines. `process.rs`
  owns child process startup, health checks, restart, and crash monitoring.
  `types.rs` owns server handles and status DTOs. `lifecycle.rs` owns the
  public spawn/restart API used by Tauri setup and commands.
- `src-tauri/src/desktop_session.rs` owns desktop session secret resolution:
  `NUXT_SESSION_PASSWORD`, generated fallback secrets, and restrictive local
  secret-file writes.
- `src-tauri/src/desktop_window_state/` owns persisted window bounds,
  maximized state, and safe restore normalization. `constants.rs` owns restore
  limits and the state filename, `validation.rs` owns state safety checks and
  normalization tests, `store.rs` owns JSON read/write and in-memory state, and
  `capture.rs` owns WebView window capture and save helpers.
- `src-tauri/src/local_repository/` owns local Git and filesystem safety. Keep
  repository-relative path validation in Rust `paths/`, not in Vue components.
  The
  `read/` submodule owns read-only Git status, branch, changed-file, commit,
  and shared read-command helpers. The `diff/` submodule owns read-only file
  diff generation, Git diff commands, pathspec handling, truncation, and
  untracked-file previews. The `storage/` submodule owns remembered local
  repository state, JSON index normalization/writes, cleanup, path display, and
  timestamps. The `url/` submodule owns GitHub clone URL canonicalization,
  reserved GitHub path exclusions, and clone destination derivation. The
  `parse/` submodule owns pure Git output parsing and user input normalization;
  add new parsing behavior to the focused file or subdirectory for its Git
  output family. The `parse/status/` submodule keeps porcelain status branch
  parsing, conflict classification, and count aggregation separate. The
  `write/` submodule owns local Git write operations, split by clone, sync,
  branch, change, and shared Git helper responsibilities.
- `scripts/` owns build-time helpers for the Tauri/Nuxt integration.
- `docs/` owns operational handoff notes and deeper workflow documentation.

For the local repository feature, keep the detailed file-level boundaries in
[Desktop Git Workflow Notes](desktop-git-workflow.md) as the source of truth.

## Project Hygiene Rules

- Generated outputs stay out of source control: `.nuxt/`, `.output/`,
  `.node-runtime/`, `.data/`, `node_modules/`, and `src-tauri/target/`.
- Secrets stay local: `.env`, `.env.*`, generated session secrets, app data, and
  server logs are ignored.
- Add a typed function to `useDesktopRuntime.ts` before consuming a new Tauri
  command from frontend code. Put command wrappers in
  `app/composables/desktop-runtime/commands.ts` or
  `localRepositoryCommands.ts`, and keep `useDesktopRuntime.ts` as the stable
  composition/export surface.
- Add or update focused tests for utility parsing, URL handling, settings
  migration, and Rust Git-output parsing.
- Keep Rust module tests next to the behavior they cover; `src-tauri/src/lib.rs`
  should stay focused on Tauri setup and registration, while
  `src-tauri/src/desktop_commands/` stays focused on command bridging.
- Prefer small feature components and composables over growing large page files.
- Keep local Git operations conservative: validate paths, avoid shell
  interpolation, and keep destructive actions explicit.

## Release Notes

- Linux is the current packaged target. `tauri.conf.json` currently enables the
  `deb` bundle target.
- Release builds bundle Nuxt/Nitro output and a Linux x64 Node runtime unless
  `NEKOGIT_NODE_PATH` is supplied at runtime.
- Use `NEKOGIT_NODE_RUNTIME_VERSION=<version> pnpm client:build` when the
  bundled Node version needs to be pinned.
- Use `NEKOGIT_CLIENT_URL=http://127.0.0.1:3000` to point the desktop client at
  an external/self-hosted instance instead of the bundled server.

## Next-Stage Priorities

- Continue expanding remote branch workflows as explicit commands rather than
  extending local branch switch implicitly. Remote checkout is now separated;
  remote publish/rebase flows should follow the same pattern.
- Add visual end-to-end coverage for the desktop local repository panel after
  the UI stabilizes.
- Expand release packaging only after the Linux `.deb` path remains stable.
- Keep module boundaries strict before adding more GitHub write operations.
