#!/usr/bin/env bash
# Push this repo to GitHub using GitHub CLI (after: gh auth login)
# Default owner matches Cursor-linked account: xghostraid (override: GITHUB_OWNER=you ./scripts/push-github.sh)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v gh >/dev/null 2>&1; then
  echo "Install GitHub CLI: brew install gh"
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "Not logged in. Run this once in your terminal (browser/device flow):"
  echo "  gh auth login"
  exit 1
fi

GITHUB_OWNER="${GITHUB_OWNER:-xghostraid}"
REPO_NAME="${1:-rise-prediction-market}"
FULL_NAME="${GITHUB_OWNER}/${REPO_NAME}"

echo "Creating ${FULL_NAME} and pushing (logged in as $(gh api user -q .login))..."
gh repo create "${FULL_NAME}" --public --source=. --remote=origin --push

echo "Done: https://github.com/${FULL_NAME}"
