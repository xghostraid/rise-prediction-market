# Push this repo to GitHub

**Canonical repo:** [github.com/xghostraid/rise-prediction-market](https://github.com/xghostraid/rise-prediction-market) (create it with the script below if it does not exist yet).

## One-shot with GitHub CLI (`gh`) — run in **your** terminal

`gh` is installed (e.g. via Homebrew). Cursor’s agent **cannot** complete login for you; you must authenticate once as **`xghostraid`** (or whichever account should own the repo):

```bash
export PATH="/opt/homebrew/bin:$PATH"
gh auth login
```

Then from this repo:

```bash
cd /Users/xace56/Downloads/rise-prediction-market
chmod +x scripts/push-github.sh
./scripts/push-github.sh
```

- Optional first argument: another repo name, e.g. `./scripts/push-github.sh my-repo-name` → creates **`xghostraid/my-repo-name`**.
- Optional env: `GITHUB_OWNER=other-org ./scripts/push-github.sh` to publish under a different user or org (you need permission there).

If you see “remote origin already exists”:

```bash
git remote remove origin
./scripts/push-github.sh
```

---

## Manual: empty repo first, then push

1. On GitHub (as **xghostraid**): **New repository** → name `rise-prediction-market` → **no** README (you already have commits).
2. In a terminal:

```bash
cd /Users/xace56/Downloads/rise-prediction-market
git remote add origin https://github.com/xghostraid/rise-prediction-market.git
git push -u origin main
```

SSH:

```bash
git remote add origin git@github.com:xghostraid/rise-prediction-market.git
git push -u origin main
```

3. If `origin` already exists from a failed attempt:

```bash
git remote remove origin
# then add again as above
```

---

## Cursor UI (uses your connected GitHub account)

1. Open the **`rise-prediction-market`** folder in Cursor.
2. Open **Source Control** (branch icon).
3. Use **Publish to GitHub** / **Publish Repository**.  
   Ensure the GitHub account in Cursor is **xghostraid** so the remote matches this doc.

---

## What’s already committed

- Source + `web/` app, `lib/forge-std`, scripts.  
- **Not** committed: `web/node_modules`, `web/.next`, `web/.env.local`, Foundry `out/`, `cache/`, `broadcast/` (see `.gitignore`).
