---
name: fork-sync
description: Sync and maintain the fun-ed/agent-office fork. Use to merge upstream AgentSystemLabs/agent-office main into the fork's main, to ship a fork-only change, to resolve sync conflicts with the fork's own patches, or to send a fork patch back upstream.
---

# fork-sync

`docs/fork.md` 是完整說明，本 skill 是給 agent 照著做的程序。開始前先讀 `docs/fork.md` 的「目前的自家改動」表格。

## 固定事實

- `origin` 是 upstream `AgentSystemLabs/agent-office`，只用來 fetch。fun-ed 對它沒有寫入權限。
- `fork` 是 `fun-ed/agent-office`。fork 的 `main` 等於 upstream `main` 加上自家 commit。
- 這個 fork 的改動直接推到 `fork` 的 `main`，不對 upstream 開 PR。只有使用者明確要求時，才送回 upstream。這條規則取代 `AGENTS.md` 的「每個改動都要對 upstream 開 PR」。
- 跟上 upstream 用 merge，不用 rebase。不 force push fork 的 `main`。
- `perf/firefox-mac-retina` 是 upstream PR #375 的 head。不要推到這個分支，除非使用者要求更新 #375。

## 同步程序

1. 在共用的主要 checkout 只做 fetch，不在那裡 merge、stash、reset 或 commit：
   `git -C /Users/edward_oo/temp/agent-office fetch --multiple origin fork`（`git fetch origin fork` 會把 `fork` 當成 `origin` 上的 ref 而失敗）
2. `git log --oneline fork/main..origin/main` 沒有輸出時，回報「已是最新」並停止。
3. 開 worktree：`git worktree add ../agent-office-sync -b sync/<YYYYMMDD> fork/main`。
4. 在 worktree 裡執行 `git merge --no-ff origin/main -m "Merge upstream main into fork"`。
5. 有衝突就依 `docs/fork.md` 的「衝突時」處理，兩邊都保留。自家改動已被 upstream 收進去時，以 fork 的版本為準。執行 `git diff --check`，確認沒有衝突標記。
6. 驗證：`mise exec -- npm ci`、`mise exec -- npm run typecheck`、`mise exec -- npm test`、`mise exec -- npm run build`。任何一項失敗就停止，回報失敗的指令和輸出，不要推送。
7. `git push fork HEAD:main`。被拒絕時，先 merge `fork/main`，重新驗證後再推送，絕不加 `--force`。
8. 移除 worktree 和 `sync/` 分支。
9. 回報 upstream 新增了哪些 commit、哪些檔案有衝突以及怎麼解、驗證結果，以及推送後 fork `main` 的 commit。

## 新增 fork 自家改動

1. `git worktree add ../agent-office-<名稱> -b <分支> fork/main`。
2. 遵守 `AGENTS.md` 的程式碼規則：功能以模組加入 registry、`tests/size.test.ts` 保持通過、使用方式有變時更新 `README.md` 和 `docs/*.md`。
3. 跑完同步程序第 6 步的驗證，再 `git push fork HEAD:main`。
4. 在 `docs/fork.md` 的「目前的自家改動」表格加上這筆改動。

## 送回 upstream（只在使用者要求時）

1. 從 `origin/main` 開新分支，只 cherry-pick 要送出的 commit。不要包含 `docs/fork.md`、本 skill，以及 `CLAUDE.md` 和 `README.md` 的 fork 段落。
2. 推到 `fork` 的同名分支，對 `AgentSystemLabs/agent-office` 開 PR，並回報 PR URL。

## 停下來問使用者

- merge 需要刪掉某一邊的功能才能解開衝突。
- 驗證失敗，而且原因出在 upstream 新加的程式碼。
- 需要 force push、重設 fork `main`，或按 GitHub 的 **Discard commits**。
