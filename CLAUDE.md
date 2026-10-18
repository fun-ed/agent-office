@AGENTS.md

## This fork (fun-ed/agent-office)

This checkout is the `fun-ed/agent-office` fork. Where these rules and `AGENTS.md` disagree, these win:

- Ship changes to the fork: branch from `fork/main` in a worktree, run the `AGENTS.md` checks, then `git push fork HEAD:main` (fast-forward only, never `--force`). Open a PR against `AgentSystemLabs/agent-office` only when the user asks to send a change upstream.
- `origin` is upstream and is only fetched. `fork` is `https://github.com/fun-ed/agent-office.git`.
- Sync upstream by merging `origin/main` into the fork's `main`, never by rebasing. Follow the `fork-sync` skill (`.claude/skills/fork-sync/SKILL.md`); `docs/fork.md` has the full guide and the list of the fork's own patches.
- Don't push to `perf/firefox-mac-retina`: it is the head of upstream PR #375.
