#!/usr/bin/env bash
# RailGuard AI — start/stop both services.
#   ./run.sh start   → backend :8000 + frontend :3000 (logs in data/logs/)
#   ./run.sh stop    → stop both
#   ./run.sh status  → what is listening
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOGS="$ROOT/data/logs"
mkdir -p "$LOGS"

start() {
  if lsof -iTCP:8000 -sTCP:LISTEN >/dev/null 2>&1; then
    echo "backend already on :8000"
  else
    cd "$ROOT/backend"
    nohup ./.venv39/bin/python -m uvicorn app.main:app \
      --host 127.0.0.1 --port 8000 > "$LOGS/backend.log" 2>&1 < /dev/null &
    disown
    echo "backend  → http://127.0.0.1:8000 (log: data/logs/backend.log)"
  fi

  if lsof -iTCP:3000 -sTCP:LISTEN >/dev/null 2>&1; then
    echo "frontend already on :3000"
  else
    cd "$ROOT/frontend"
    nohup npm run dev > "$LOGS/frontend.log" 2>&1 < /dev/null &
    disown
    echo "frontend → http://localhost:3000 (log: data/logs/frontend.log)"
  fi
}

stop() {
  pkill -f 'uvicorn app.main:app' 2>/dev/null && echo "backend stopped" || echo "backend not running"
  pkill -f 'next dev' 2>/dev/null && echo "frontend stopped" || echo "frontend not running"
}

status() {
  lsof -iTCP:8000 -sTCP:LISTEN >/dev/null 2>&1 && echo "backend  :8000 up" || echo "backend  :8000 DOWN"
  lsof -iTCP:3000 -sTCP:LISTEN >/dev/null 2>&1 && echo "frontend :3000 up" || echo "frontend :3000 DOWN"
}

reports() {
  cd "$ROOT/backend"
  nohup ./.venv39/bin/python -u scripts/gen_reports.py --limit 40 --sleep 12 \
    > "$LOGS/reports.log" 2>&1 < /dev/null &
  disown
  echo "generating AI reports in background (log: data/logs/reports.log)"
}

case "${1:-start}" in
  start) start ;;
  stop) stop ;;
  restart) stop; sleep 1; start ;;
  status) status ;;
  reports) reports ;;
  *) echo "usage: ./run.sh {start|stop|restart|status|reports}"; exit 1 ;;
esac
