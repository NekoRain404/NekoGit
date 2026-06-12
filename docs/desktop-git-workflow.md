# Desktop Git Workflow Notes

NekoGit desktop Git features are split across a small set of files so future
work can extend the client without growing one large entry point.

## Rust Boundaries

- `src-tauri/src/local_repository/mod.rs` owns local Git workflow orchestration:
  fetch, pull, branch switching, branch creation, commits, stashes, push, and
  clone command flow.
- `src-tauri/src/local_repository/write/` owns local Git write operations.
  `clone.rs` owns GitHub clone flow, `sync.rs` owns fetch/pull/push,
  `branches.rs` owns branch switch/create/remote checkout, `changes.rs` owns
  commit/stash, and `git.rs` owns shared Git command/ref helpers.
- `src-tauri/src/local_repository/url/` owns GitHub clone URL rules.
  `normalize.rs` owns clone URL parsing and canonicalization, `reserved.rs`
  owns GitHub web path exclusions, and `destination.rs` owns clone destination
  derivation. Keep clone-specific GitHub owner/repo validation here rather than
  sharing desktop navigation constants.
- `src-tauri/src/local_repository/storage/` owns remembered local repository
  state. `status.rs` owns remember/status/cleanup workflows, `index.rs` owns
  JSON index normalization plus atomic writes, `paths.rs` owns the index file
  path, `display.rs` owns display-safe path conversion, and `time.rs` owns
  timestamp generation.
- `src-tauri/src/local_repository/paths/` owns repository-relative path safety.
  `normalize.rs` owns relative path normalization and display formatting,
  `resolve.rs` owns repository-root containment checks, and `status.rs` owns
  local path status responses.
- `src-tauri/src/local_repository/diff/` owns read-only file diff generation.
  `mod.rs` owns the public file-diff response assembly, `command.rs` owns Git
  diff process execution, `pathspec.rs` owns rename-aware pathspecs,
  `truncate.rs` owns UTF-8-safe byte truncation, and `untracked.rs` owns
  untracked-file detection and preview diff generation.
- `src-tauri/src/local_repository/read/` owns read-only Git queries.
  `status.rs` owns porcelain status plus last-commit attachment,
  `branches.rs` owns local/remote branch listing and checkoutability,
  `changed_files.rs` owns changed-file status listing, `commits.rs` owns last
  commit and commit history reads, and `git.rs` owns shared read-only Git
  command helpers.
- `src-tauri/src/local_repository/parse/` owns pure Git output parsing and user
  input normalization for local Git workflows. `failure.rs` owns Git command
  failure details, `status/` owns porcelain status parsing split by branch
  header parsing, conflict status classification, and file-count aggregation,
  `changed_files.rs` owns changed-file porcelain parsing, `commit.rs` owns
  commit/log parsing, `branches.rs` owns local/remote branch parsing, and
  `input.rs` owns branch and commit-message normalization.
- `src-tauri/src/local_repository/types.rs` owns the serializable DTOs and
  local repository limits shared by Tauri commands, tests, and Git workflow
  logic.
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
- Tauri command permissions live under
  `src-tauri/permissions/autogenerated/commands/`.
- `src-tauri/capabilities/default.json` must allow every command used by the
  frontend.

Keep repository path validation inside `local_repository/paths/`. UI and
command handlers should pass repository URLs and relative paths, not construct
local paths.

## Frontend Boundaries

- `app/composables/useDesktopRuntime.ts` is the typed command bridge.
- `app/composables/useLocalRepositoryPanel.ts` owns local repository panel
  state, derived labels, request guards, and desktop Git actions. It is the only
  frontend layer that should call the local repository functions from
  `useDesktopRuntime.ts`.
- `app/composables/local-repository-panel/types.ts` owns the shared copy/action
  contracts for the local repository workflow.
- `app/composables/local-repository-panel/viewModel.ts` owns pure derived panel
  state such as labels, tones, badges, diff sections, and commit availability.
- `app/composables/local-repository-panel/desktopDialogs.ts` owns lazy Tauri
  dialog imports and desktop error-message normalization.
- `app/components/dashboard/RepoDetail.vue` owns repository detail page
  composition only. It should pass owner/repo/branch context to
  `LocalRepositoryPanel` and should not call Tauri or manage local Git state.
- `app/components/dashboard/repo/LocalRepositoryPanel.vue` creates the local
  repository panel state and provides it to focused child components through
  `localRepositoryPanelContext.ts`.
- `app/components/dashboard/repo/LocalRepositoryGitSummary.vue`,
  `LocalRepositoryChangedFiles.vue`, `LocalRepositoryCommitHistory.vue`, and
  `LocalRepositoryActions.vue` own separate UI sections for Git summary, file
  diff preview, commit history, and command buttons.

When adding a desktop command, add a typed function to `useDesktopRuntime.ts`
first, then consume that function from a dedicated composable. Avoid direct
`invoke()` calls inside view components.

File organization is a first-order requirement: prefer extracting a focused
component/composable before adding more behavior to a large view. Page
components should compose features; composables should own stateful workflows;
Rust modules should own filesystem and Git safety rules.

## Current Local Workflow

The repository detail sidebar supports:

- clone a GitHub repository to a user-selected directory
- open the remembered local repository
- open a terminal at the repository root
- fetch and fast-forward pull
- list local branches, switch to an existing local branch, and create a new
  local branch from the current `HEAD`
- list `origin/*` remote branches and explicitly checkout a remote branch into
  a new local tracking branch
- show branch, ahead/behind, dirty counts, last commit, changed files, and
  recent commits
- preview staged, unstaged, and untracked text diffs for changed files
- open an individual changed file from the diff list
- commit all current local changes with a user-provided commit message
- stash all current local changes, including untracked files, without applying
  them back automatically
- push the current local branch, or publish it to `origin` when it has no
  upstream

Diff generation is read-only. It uses normalized repository-relative paths and
`git diff -- ...` pathspecs rather than shell interpolation.

Branch switching is intentionally conservative: it uses `git switch -- <name>`,
requires the target to exist under `refs/heads/`, and rejects dirty worktrees
before switching.

Remote branch checkout is a separate command. It only accepts normalized
`origin/*` refs that exist under `refs/remotes/origin/`, rejects `origin/HEAD`,
requires a clean worktree, rejects remote branches whose local branch name
already exists, and runs `git switch --track -c <local> <origin/local>`.

Branch creation uses `git switch -c <name>` and applies the same dirty-worktree
guard. Branch names are normalized in Rust and reject whitespace, control
characters, option-like names, lock-file suffixes, and unsupported Git ref
characters.

Local commits are intentionally explicit and local-only: the desktop command
normalizes the commit message, rejects empty messages and unresolved conflicts,
stages all repository changes with `git add -A -- .`, verifies the index is not
empty, and then runs `git commit -m <message>`.

Local stashes are also explicit and local-only: the desktop command rejects
clean worktrees and unresolved conflicts, then runs
`git stash push --include-untracked -m "NekoGit: stash <branch>"`. NekoGit
does not auto-pop or auto-apply the stash.

Pushing requires a clean worktree and an active branch. If the branch has an
upstream, NekoGit runs `git push` and reports when there are no local commits
to push. If the branch has no upstream, NekoGit publishes it with
`git push --set-upstream origin <branch>`.

## Required Validation

After changing Tauri commands or Rust modules:

```bash
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo check --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
pnpm fmt:check
pnpm typecheck
pnpm lint
pnpm test
pnpm client:build
```

For release packaging, rebuild the Debian bundle with:

```bash
pnpm client:build
```

The pnpm registry for this workspace should remain:

```text
https://registry.npmmirror.com
```
