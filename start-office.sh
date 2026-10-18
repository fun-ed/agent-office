#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
URL="http://localhost:4600"

healthy() {
  [[ "$(curl --noproxy '*' --fail --silent --max-time 2 "$URL/api/health" || true)" == '{"ok":true}' ]]
}

office_pid() {
  local pid command
  pid="$(lsof -nP -t -iTCP:4600 -sTCP:LISTEN 2>/dev/null || true)"
  [[ "$pid" =~ ^[0-9]+$ ]] || return 1
  command="$(ps -ww -p "$pid" -o command=)" || return 1
  [[ "$command" == *bin/agent-office.js* && "$command" == *"$ROOT"* ]] || return 1
  printf '%s\n' "$pid"
}

case "${1:-start}" in
  start)
    if healthy; then
      printf 'Agent Office 已在執行：%s\n' "$URL"
      open "$URL"
      exit 0
    fi
    cd -- "$ROOT"
    exec mise exec -- node "$ROOT/bin/agent-office.js" "$ROOT" \
      --agent omp --host 127.0.0.1 --port 4600
    ;;
  status)
    if pid="$(office_pid)"; then
      if healthy; then
        printf 'Agent Office 執行中，PID %s：%s\n' "$pid" "$URL"
        exit 0
      fi
      printf 'Agent Office 程序存在，PID %s，但健康檢查失敗。\n' "$pid"
    else
      printf '未找到此專案的 Agent Office 服務。\n'
    fi
    exit 1
    ;;
  stop)
    if ! pid="$(office_pid)"; then
      printf '未找到可安全停止的 Agent Office 程序；未送出任何訊號。\n'
      exit 1
    fi
    # SIGINT closes the office and its workers; SIGTERM leaves workers running.
    kill -INT "$pid"
    for ((i = 0; i < 50; i++)); do
      if ! kill -0 "$pid" 2>/dev/null; then
        printf 'Agent Office 與 workers 已關閉。\n'
        exit 0
      fi
      sleep 0.2
    done
    printf '已送出停止訊號，但程序仍存在；未強制終止。\n' >&2
    exit 1
    ;;
  *)
    printf '用法：%s [start|status|stop]\n' "$0" >&2
    exit 2
    ;;
esac
