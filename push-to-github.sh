#!/usr/bin/env bash
# Publish Northlight to a GitHub repository.
#
#   ./push-to-github.sh                 # repo name "northlight", public
#   ./push-to-github.sh my-app          # custom repo name
#   ./push-to-github.sh my-app --private
#   ./push-to-github.sh --dry-run       # show what would happen, change nothing
#
# Needs: git, and the GitHub CLI (gh) signed in once with `gh auth login`.
# Never commits secrets: .env, the demo database, uploads, logs and builds are ignored.

set -euo pipefail

REPO="northlight"
VISIBILITY="--public"
DRY_RUN=0

for arg in "$@"; do
  case "$arg" in
    --private) VISIBILITY="--private" ;;
    --public) VISIBILITY="--public" ;;
    --dry-run) DRY_RUN=1 ;;
    -h|--help) sed -n '2,12p' "$0"; exit 0 ;;
    -*) echo "Unknown option: $arg" >&2; exit 2 ;;
    *) REPO="$arg" ;;
  esac
done

cd "$(dirname "$0")"

say() { printf '\033[1;36m›\033[0m %s\n' "$*"; }
die() { printf '\033[1;31m✗\033[0m %s\n' "$*" >&2; exit 1; }

# ---------- sanity ----------
[ -f package.json ] || die "Run this from the project folder (package.json not found)."
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || die "This folder is not a git repository."

NAME="$(git config user.name || true)"
EMAIL="$(git config user.email || true)"
if [ -z "$NAME" ] || [ -z "$EMAIL" ]; then
  if [ -t 0 ]; then
    say "Git does not know who you are yet. This is stored in this project only."
    printf '  Your name:  '; read -r NAME
    printf '  Your email: '; read -r EMAIL
    [ -n "$NAME" ] && [ -n "$EMAIL" ] || die "A name and an email are both required."
    git config user.name "$NAME"
    git config user.email "$EMAIL"
  else
    die "Set your git identity first:
  git config user.name  \"Your Name\"
  git config user.email \"you@example.com\""
  fi
fi

# A repo name must be a valid GitHub slug.
[[ "$REPO" =~ ^[A-Za-z0-9._-]+$ ]] || die "'$REPO' is not a valid repository name."

# ---------- make sure the working tree is safe to commit ----------
say "Checking what would be uploaded…"
git add -A

if git diff --cached --name-only | grep -Eq '(^|/)(\.env|node_modules|dist|logs)/|^server/data/|\.log$'; then
  echo
  git diff --cached --name-only | grep -E '(^|/)(\.env|node_modules|dist|logs)/|^server/data/|\.log$' | sed 's/^/    /'
  die "The list above must not be published. They are ignored by .gitignore — check that it still exists."
fi

if [ "$DRY_RUN" = 1 ]; then
  say "Dry run: $(git diff --cached --name-only | wc -l | tr -d ' ') file(s) would be committed and pushed."
  git diff --cached --name-only | sed 's/^/    /'
  git reset -q
  say "Nothing was committed, renamed, or pushed."
  exit 0
fi

if git diff --cached --quiet; then
  say "Nothing new to commit — the files are already committed."
else
  say "Committing the app…"
  git commit -q -m "$(cat <<'EOF'
Northlight: dignity-first app for people experiencing homelessness

Location sharing, circle and messages, resources and food delivery,
residency applications, needs and wishes, live world/US/state news,
solo and two-player games, photos, reels and blog, success stories,
SOS alerts, blocking, notifications, and settings with data export
and account deletion.
EOF
)"
  git log --oneline -1
fi

# Put the app on a normal branch name so GitHub shows it as the default.
BRANCH="$(git branch --show-current)"
if [ "$BRANCH" != "main" ]; then
  say "Switching to the main branch (from $BRANCH)…"
  [ "$DRY_RUN" = 1 ] || git checkout -q -B main
  BRANCH="main"
fi

# ---------- publish ----------
if git remote get-url origin >/dev/null 2>&1; then
  ORIGIN="$(git remote get-url origin)"
  say "Remote already set: $ORIGIN"
  if [ "$DRY_RUN" = 1 ]; then
    say "Dry run: would run  git push -u origin $BRANCH"
    exit 0
  fi
  git push -u origin "$BRANCH"
  say "Pushed. Open $ORIGIN"
  exit 0
fi

command -v gh >/dev/null 2>&1 || die "The GitHub CLI (gh) is not installed.

Either install it (https://cli.github.com) and run 'gh auth login', or create an empty
repository on github.com yourself, then run:
  git remote add origin https://github.com/YOUR-NAME/$REPO.git
  git push -u origin $BRANCH"

if ! gh auth status >/dev/null 2>&1; then
  die "The GitHub CLI is not signed in. Run:
  gh auth login

…then run this script again. (Or create an empty repo on github.com and run:
  git remote add origin https://github.com/YOUR-NAME/$REPO.git
  git push -u origin $BRANCH )"
fi

if [ "$DRY_RUN" = 1 ]; then
  say "Dry run: would create '$REPO' $VISIBILITY and push branch $BRANCH"
  exit 0
fi

OWNER="$(gh api user --jq .login)"
say "Creating github.com/$OWNER/$REPO and pushing…"
gh repo create "$REPO" --description "Northlight — a dignity-first app for people experiencing homelessness" "$VISIBILITY"
git remote add origin "https://github.com/$OWNER/$REPO.git"
git push -u origin "$BRANCH"

say "Done: $(gh repo view "$REPO" --json url --jq .url 2>/dev/null || echo "https://github.com/$(gh api user --jq .login)/$REPO")"
say "Anyone who clones it needs 'npm install', then 'npm run dev'."
