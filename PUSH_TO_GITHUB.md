# Push this repo to GitHub

## One-shot with GitHub CLI (`gh`) — run in **your** terminal

`gh` is installed (e.g. via Homebrew). Cursor’s agent **cannot** complete login for you; you must authenticate once:

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

Optional: `./scripts/push-github.sh my-repo-name` to use a different repo name.

If you see “remote origin already exists”:

```bash
git remote remove origin
./scripts/push-github.sh
```

To push under an **organization** (e.g. `gsd-build`): create the repo on github.com first (empty), then:

```bash
git remote add origin https://github.com/gsd-build/rise-prediction-market.git
git push -u origin main
```

---

## What we could (and could not) detect

- **Cursor’s GitHub sign-in** does not put your username in a plain-text file inside the project, so it can’t be “looked up” from disk here.
- Another folder on your machine uses this remote: `https://github.com/gsd-build/get-shit-done.git` — if **you** control the **`gsd-build`** org, you can create **`gsd-build/rise-prediction-market`** on GitHub and use the commands below with `gsd-build`. Otherwise use **your personal** username.

## Easiest: Cursor UI (uses your connected GitHub account)

1. Open the **`rise-prediction-market`** folder in Cursor.
2. Open **Source Control** (branch icon).
3. Use **Publish to GitHub** / **Publish Repository** (wording varies).  
   That flow uses the GitHub account already linked in Cursor and creates the remote + push for you.

## Manual: create empty repo, then push

1. On GitHub: **New repository** → name e.g. `rise-prediction-market` → **no** README (you already have commits).
2. In a terminal:

```bash
cd /Users/xace56/Downloads/rise-prediction-market
git remote add origin https://github.com/YOUR_USERNAME_OR_ORG/rise-prediction-market.git
git push -u origin main
```

Use **SSH** if you prefer:

```bash
git remote add origin git@github.com:YOUR_USERNAME_OR_ORG/rise-prediction-market.git
git push -u origin main
```

3. If `origin` already exists from a failed attempt:

```bash
git remote remove origin
# then add again as above
```

## What’s already committed

- Source + `web/` app, `lib/forge-std`, scripts.  
- **Not** committed: `web/node_modules`, `web/.next`, `web/.env.local`, Foundry `out/`, `cache/`, `broadcast/` (see `.gitignore`).
