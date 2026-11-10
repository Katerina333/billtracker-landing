#!/usr/bin/env bash
# Publishes the SEO agent's work: validate → build → commit → push to `cloudflare` (Cloudflare Pages
# builds and deploys that branch).
#
# Run from the landing repo clone. Usage: seo-agent/publish.sh "<commit subject>"
set -euo pipefail
cd "$(dirname "$0")/.."

subject="${1:?usage: seo-agent/publish.sh \"<commit subject>\"}"
branch="cloudflare"

[ "$(git rev-parse --show-toplevel)" = "$PWD" ] || { echo "✗ run this from the landing repo clone"; exit 1; }
[ "$(git branch --show-current)" = "$branch" ] || { echo "✗ not on $branch"; exit 1; }
git fetch -q origin "$branch"
[ "$(git rev-parse HEAD)" = "$(git rev-parse "origin/$branch")" ] || { echo "✗ HEAD is not origin/$branch — pull first and redo the work on top"; exit 1; }

node seo-agent/validate.mjs
[ -d node_modules ] || npm ci --silent
npm run build

# Only the agent's own paths are staged; validate.mjs has already refused anything else.
git add -A blog seo-agent
git diff --cached --quiet && { echo "nothing to publish"; exit 0; }
git commit -q -m "$subject" -m "Published by the daily SEO agent (seo-agent/AGENT.md)."
git push -q origin "HEAD:$branch"
echo "✓ pushed $(git rev-parse --short HEAD) to $branch — Cloudflare deploys in ~1–3 min"
