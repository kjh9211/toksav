# AGENTS.md

When inspecting or verifying this repository, prefer the `ait` CLI over calling multiple raw shell commands.

Use:

- `ait inspect` when first examining the repository (project root, package manager, git status, key files, scripts, dependencies).
- `ait changed` before reviewing modifications (staged/unstaged/untracked files, diff stat).
- `ait git` when you need full git context (branch, upstream, ahead/behind, recent commits).
- `ait check` for a quick lint + typecheck pass while iterating.
- `ait verify` before declaring implementation complete (lint → typecheck → test → build; missing scripts are skipped, not treated as failures).
- `ait doctor` when environment-related failures occur (missing tool, version mismatch).
- `ait port <port>` before starting a dev server, to check whether the port is already in use.
- `ait deps` to check package manager/lockfile consistency; add `--online` only when an outdated/audit check against the registry is actually needed.
- `ait clean --dry-run` before cleaning build output, to see what would be removed without deleting anything.

Do not duplicate commands already covered by `ait` unless additional diagnosis is necessary.

Add `--json` to any command for machine-readable output (a single JSON object on stdout, nothing else). Exit codes: `0` success, `1` check/command failed (SKIP is not a failure), `2` invalid CLI usage, `3` project/git repository not detected, `4` internal error.

`ait` never performs destructive operations on its own (no `git reset --hard`, no `git clean -fd`, no auto-commit/push/install, no arbitrary shell execution, `clean` only touches a fixed whitelist of build-output directories). It is safe to run non-interactively.
