# Agent Instructions

## Windows Codex sandbox and Git permissions

- Keep the repository and its `.git` directory owned by the interactive Windows user who owns this workspace. Do not change ownership to `CodexSandboxOffline` or another sandbox/service account.
- Do not recursively modify repository permissions or ownership. In particular, do not use recursive `takeown`, `icacls`, or broad ACL resets on the workspace.
- Preserve the existing ACLs on `.git` unless a user explicitly authorizes a targeted repair.
- If a command fails before PowerShell, `cmd`, `git`, or `rg` starts with an error such as `helper_unknown_error: setup refresh had errors`, inspect the latest `%USERPROFILE%\.codex\.sandbox\*.log` file before changing project files.
- If the log contains `deny ACE failed`, `SetNamedSecurityInfoW failed`, `Access denied`, or Windows error `5`, inspect the exact path named in the log. The issue is likely a Windows ownership/ACL problem on that path, often the repository's `.git` directory.
- Do not attempt to repair ownership from the sandboxed agent session if it lacks ownership privileges. Ask the user to run a targeted ownership repair in an elevated PowerShell window, then retry the command.
- After any permission repair, verify that the affected directory is owned by the user's normal Windows account, restart Codex if needed, and rerun the original command.

## Git verification

- Before reporting that work was committed or pushed, verify all of the following:
  - `git status --short --branch` shows no uncommitted changes.
  - `git log -1 --oneline --decorate` identifies the expected commit.
  - `git branch -vv` shows the local branch tracking the expected remote branch with no `ahead` or `behind` indicator.
  - `git remote -v` identifies the intended remote repository.
- Never claim that a push succeeded based only on a local commit. Confirm the remote tracking state.
