#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
FRONTEND_DIR="${ROOT_DIR}/apps/main-app"
BACKEND_DIR="${ROOT_DIR}/backend"

echo "=========================================="
echo " Worknity Verification Suite (TDD & QA)"
echo "=========================================="

# 1. Frontend Checks (TypeScript, Lint, Vitest)
if [ -d "${FRONTEND_DIR}" ]; then
  echo ""
  echo "[1/2] フロントエンド検証を実行中 (apps/main-app)..."
  cd "${FRONTEND_DIR}"

  echo "  -> TypeScript 型チェック (tsc -b)..."
  npx tsc -b

  echo "  -> ESLint チェック (npm run lint)..."
  npm run lint

  echo "  -> Vitest 自動テスト実行 (npx vitest run)..."
  npx vitest run
fi

# 2. Backend Checks (Laravel PHPUnit / Pint)
if [ -d "${BACKEND_DIR}" ]; then
  echo ""
  echo "[2/2] バックエンド検証を実行中 (backend)..."
  cd "${BACKEND_DIR}"

  if command -v php >/dev/null 2>&1; then
    echo "  -> 호ストPHPで Laravel テストを実行 (php artisan test)..."
    php artisan test
  elif command -v docker >/dev/null 2>&1 && docker compose ps --status running 2>/dev/null | grep -q "backend"; then
    echo "  -> Docker コンテナ内で Laravel テストを実行 (docker compose exec -T backend php artisan test)..."
    cd "${ROOT_DIR}"
    docker compose exec -T backend php artisan test
  else
    echo "  ⚠️ 警告: ホスト上に php コマンドが見つからず、起動中の backend Docker コンテナも検出されませんでした。"
    echo "  バックエンドを変更した場合は、Docker コンテナを起動して 'docker compose exec backend php artisan test' を必ず実行してください。"
  fi
fi

echo ""
echo "✅ Worknity 検証スイートが完了しました。"

