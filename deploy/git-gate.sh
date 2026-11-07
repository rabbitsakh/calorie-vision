#!/bin/bash
# Общий затвор для cv-release и deploy.sh.
# Можно подключать через source. При прямом запуске — проверка и код выхода.

# Файлы, которые сборка переписывает и которые нельзя оставлять грязными:
# package.json / changelog — sync-app-version; tsconfig.json и next-env.d.ts — Next
# (при NEXT_DIST_DIR=.next-build путь типов становится .next-build и ломает следующий pull).
restore_deploy_generated_files() {
  local path
  # По одному: отсутствующий путь не должен отменять восстановление остальных.
  for path in \
    package.json \
    package-lock.json \
    src/data/changelog.json \
    tsconfig.json \
    next-env.d.ts
  do
    git restore --quiet -- "$path" 2>/dev/null || true
  done
}

# Успех только если fast-forward на origin/main прошёл и HEAD совпал с ним.
# Иначе ненулевой код и текст в stderr. Сборку не запускает.
ensure_ff_origin_main() {
  local attempts="${DEPLOY_PULL_ATTEMPTS:-4}"
  local attempt=1
  local log rc=1
  restore_deploy_generated_files
  log="$(mktemp)"
  while (( attempt <= attempts )); do
    # Нельзя снимать $? после if: у неудачного if код 0, и провал pull выглядит успехом.
    git pull --ff-only origin main >"$log" 2>&1 && rc=0 || rc=$?
    if (( rc == 0 )); then
      break
    fi
    if (( attempt < attempts )); then
      sleep $((attempt * 8))
    fi
    attempt=$((attempt + 1))
  done
  if (( rc != 0 )); then
    printf '%s\n' "✗ git pull не удался — сборка отменена, рабочий сайт не перезапускался." >&2
    printf '%s\n' "  Часто мешают локальные правки после сборки (tsconfig.json, next-env.d.ts)." >&2
    printf '%s\n' "  Вывод git:" >&2
    cat "$log" >&2 || true
    printf '%s\n' "  Уберите лишнее (git status) и повторите: cv-release --deploy-only" >&2
    rm -f "$log"
    return 1
  fi
  rm -f "$log"
  local head origin
  head="$(git rev-parse HEAD)"
  origin="$(git rev-parse origin/main)"
  if [[ "$head" != "$origin" ]]; then
    printf '%s\n' "✗ После pull HEAD ${head:0:7} не совпадает с origin/main ${origin:0:7}." >&2
    printf '%s\n' "  Сборка отменена, рабочий сайт не трогали." >&2
    return 1
  fi
  return 0
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  set -euo pipefail
  ensure_ff_origin_main
fi
