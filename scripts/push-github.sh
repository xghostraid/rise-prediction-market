#!/usr/bin/env bash
# Push this repo to GitHub using GitHub CLI (after: gh auth login)
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

REPO_NAME="${1:-rise-prediction-market}"

echo "Creating repo and pushing (logged in as $(gh api user -q .login))..."
gh repo create "${REPO_NAME}" --public --source=. --remote=origin --push

echo "Done."
