# 維護 fun-ed 的 fork

回到 [README](../README.md)。

本頁說明 `fun-ed/agent-office` 這個 fork 怎麼維護：自家的改動放在哪裡、怎麼跟上 upstream、怎麼驗證，以及出錯時怎麼回退。這頁只屬於這個 fork，upstream 沒有這頁。

## 這個 fork 是什麼

- **Upstream**：`AgentSystemLabs/agent-office`。fun-ed 對它只有 READ 權限。
- **Fork**：`fun-ed/agent-office`，預設分支是 `main`。
- **Fork 的 `main`** 等於 upstream 的 `main` 加上自家的 commit。自家 commit 直接進 fork 的 `main`，不必對 upstream 開 PR。只有明確要送回 upstream 時，才另開分支並對 upstream 開 PR。
- 跟上 upstream 時用 **merge**，不用 rebase。fork 的 `main` 已經推上 GitHub，rebase 之後只能 force push，會改寫已發布的歷史。merge 可以一直用 fast-forward push。

## 本機的 remote

本機 clone 在 `/Users/edward_oo/temp/agent-office`，remote 名稱如下：

| Remote | 指向 | 用途 |
|---|---|---|
| `origin` | `https://github.com/AgentSystemLabs/agent-office.git` | 只拿來 fetch upstream |
| `fork` | `https://github.com/fun-ed/agent-office.git` | 推送 fork 的 `main` |

新的 clone 可以這樣設定：

```sh
git clone https://github.com/fun-ed/agent-office.git agent-office
cd agent-office
git remote rename origin fork
git remote add origin https://github.com/AgentSystemLabs/agent-office.git
git fetch origin fork
```

這樣 `origin` 仍然代表 upstream，和 `AGENTS.md` 及其他文件的用語一致。

## 自家的改動

查看 fork 比 upstream 多了哪些 commit：

```sh
git fetch origin fork
git log --oneline --no-merges origin/main..fork/main
```

目前的自家改動：

| 改動 | 主要檔案 | 備註 |
|---|---|---|
| 讓 Firefox 上的 3D 畫面更輕：準心射線只測到最遠互動距離 | `src/client/input/pointer.ts` | 和 upstream PR #375 的內容相同 |
| 省電模式（⚙️ → *Graphics* → **🔋 Power saver**），Firefox 預設開啟：限 30 fps、pixel ratio 1、不畫描邊、陰影貼圖 1024 且隔幀重畫、關閉 MSAA、比照 reduced motion | `src/client/core/loop.ts`、`src/client/core/scene.ts`、`src/client/state/persist.ts`、`src/client/ui/settings.ts`、`src/client/main.ts` | 取代 #375 原本 Firefox 專用的陰影隔幀和 1.5 倍 pixel ratio |
| ACP agent：Oh My Pi、Codex (ACP)、OpenCode (ACP)、Devin，透過 `mise exec --` 啟動各自原生的 ACP server，沿用 DeepSeek Harness 的 ACP 連線；model 與 effort 依 ACP `configOptions` 的 category 找選項，Devin 用 `session/load` 續接 | `src/server/providers/acp.ts`、`src/server/acp-config.ts`、`src/server/dsh.ts`、`src/server/workers/acp.ts`、`src/shared/providers.ts`、`src/client/ui/usage.ts` | 只在 fork；DeepSeek Harness 的行為不變 |
| 本機啟動腳本 `./start-office.sh [start\|status\|stop]`：以 Oh My Pi 為預設 agent，在 `127.0.0.1:4600` 啟動辦公室；已在執行時直接開瀏覽器，`stop` 只對本專案的程序送 SIGINT，連同 workers 一起關閉 | `start-office.sh` | 只在 fork |
| Fork 維護文件 | `docs/fork.md`、`.claude/skills/fork-sync/SKILL.md`、`CLAUDE.md`、`README.md` | 只屬於 fork |

新增或移除自家改動時，同時更新這張表。

## 跟上 upstream

不要在共用的主要 checkout 裡做。那裡可能有其他 session 正在使用，也有未追蹤的檔案（例如 `start-office.sh`）。每次同步都開一個新的 worktree：

```sh
cd /Users/edward_oo/temp/agent-office
git fetch origin fork
git log --oneline fork/main..origin/main          # upstream 新增的 commit；沒有輸出就不必同步
git worktree add ../agent-office-sync -b "sync/$(date +%Y%m%d)" fork/main
cd ../agent-office-sync
git merge --no-ff origin/main -m "Merge upstream main into fork"
```

### 衝突時

- 兩邊都要保留：upstream 的新功能進來，自家的改動也留著。
- 自家改動已經被 upstream 收進去時（例如 #375 被 squash merge），以 fork 的版本為準。省電模式已經取代 #375 的 `SHADOW_EVERY` 和 `MAX_PIXEL_RATIO`，這兩個常數不要再加回來。
- `README.md` 和 `CLAUDE.md` 的衝突通常只是位置不同。保留 upstream 的內容，再把 fork 的段落放回去。
- 解完衝突後，確認沒有留下衝突標記：

```sh
git diff --check
git grep -n -E '^(<<<<<<<|>>>>>>>)' -- src tests docs README.md CLAUDE.md
```

### 驗證

依照 `AGENTS.md` 的檢查項目，透過 mise 執行：

```sh
mise exec -- npm ci
mise exec -- npm run typecheck
mise exec -- npm test
mise exec -- npm run build
```

三項都通過才推送。動到畫面的同步，再加一張 headless 瀏覽器截圖。

### 推送

```sh
git push fork HEAD:main
```

這是 fast-forward push。GitHub 拒絕時，代表 fork 的 `main` 在這段時間又有新 commit。這時先 `git fetch fork`，再 `git merge fork/main`，重新驗證後再推送。**不要用 `--force`。**

### 清理

```sh
cd /Users/edward_oo/temp/agent-office
git worktree remove ../agent-office-sync
git branch -d sync/<日期>     # 用建立 worktree 時的分支名稱
```

## 新增自家改動

1. 從最新的 fork `main` 開 worktree：`git worktree add ../agent-office-<名稱> -b <分支> fork/main`。
2. 改動仍然遵守 `AGENTS.md` 的程式碼規則：新功能以模組加入 registry、`tests/size.test.ts` 要保持通過，使用方式有變時同步更新 `README.md` 和對應的 `docs/*.md`。
3. 跑完上面的驗證，再 `git push fork HEAD:main`。
4. 更新本頁的「目前的自家改動」表格。

## 送回 upstream

只有在明確要送回 upstream 時才做：

1. 從 `origin/main` 開新分支，只 cherry-pick 要送出的 commit。不要包含 fork 維護文件。
2. 推到 fork 的同名分支，再對 `AgentSystemLabs/agent-office` 開 PR。
3. PR 被 merge 後，下一次同步時以 fork 的版本解決衝突，並更新本頁的表格。

目前已送出的 PR：[#375](https://github.com/AgentSystemLabs/agent-office/pull/375)，分支是 `perf/firefox-mac-retina`。這個分支是 PR 的 head，推送到這個分支會改到 PR。fork 的改動不要推到這個分支。

## GitHub 的 Sync fork 按鈕

GitHub 網頁上的 **Sync fork** 只有在沒有衝突時才能用，它會在 fork 的 `main` 建立 merge commit，但不會跑測試。**不要按 Discard commits**，那會把 fork 的 `main` 重設成 upstream，刪掉所有自家 commit。

## 出錯時回退

- **merge 還沒推送**：`git merge --abort`，或直接刪掉同步用的 worktree。fork 的 `main` 不受影響。
- **推送了有問題的 merge**：在新的 worktree 執行 `git revert -m 1 <merge commit>`，驗證後再推送。不要 force push。
- **找回某個時間點的 fork `main`**：`git reflog show fork/main`，或在 GitHub 上看 fork 的 commit 歷史。
