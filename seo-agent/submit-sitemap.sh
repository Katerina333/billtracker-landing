#!/usr/bin/env bash
# Tells Google Search Console that the sitemap changed, so pages published today are found in days
# instead of whenever Google next re-reads the sitemap on its own. Run it after the live check
# (AGENT.md step 10), from the landing repo clone, after publish.sh built dist/.
#
# Needs gum with the Search Console `webmasters` scope (the read-only grant is not enough). It never
# fails a publish: on any problem it prints a ⚠ line for the report and exits 0.
set -uo pipefail
cd "$(dirname "$0")/.."

GUM="$HOME/.local/bin/gum"
# This site's own gum sign-in (see config.json → gumProfile); the default profile is another site's.
PROFILE=$(node -p "require('./seo-agent/config.json').gumProfile || 'default'" 2>/dev/null || echo default)
SITE="sc-domain:billtrackerx.com"
SITEMAP="https://billtrackerx.com/sitemap.xml"

# Only submit once the deploy is live: the live sitemap must list at least as many URLs as the one
# just built. If it doesn't yet, wait a minute or two and run this once more.
want=$(grep -c "<loc>" dist/sitemap.xml 2>/dev/null || echo 0)
have=$(curl -s "$SITEMAP?cb=$RANDOM" | grep -c "<loc>")
if [ "$have" -lt "$want" ]; then
  echo "⚠ sitemap not submitted yet: the live sitemap lists $have URLs, the new build $want — the deploy isn't live; run this again in 1–2 minutes"
  exit 0
fi

out=$("$GUM" write searchconsole.sitemaps.submit --profile "$PROFILE" --allow-write \
  --args "{\"siteUrl\":\"$SITE\",\"feedpath\":\"$SITEMAP\"}" --output json --log-level error 2>&1)
status=$?
if [ $status -ne 0 ] || printf '%s' "$out" | grep -q '"error_code"'; then
  code=$(printf '%s' "$out" | grep -o '"error_code": *"[A-Z_]*"' | head -1 | sed 's/.*"\([A-Z_]*\)"$/\1/')
  echo "⚠ sitemap not submitted to Search Console (${code:-gum exit $status})."
  if [ "$code" = "SCOPE_MISSING" ]; then
    echo "  Needs a human, once: ~/.local/bin/gum auth login --profile $PROFILE --scope https://www.googleapis.com/auth/webmasters,https://www.googleapis.com/auth/webmasters.readonly"
  else
    printf '%s\n' "$out" | head -5 | sed 's/^/  /'
  fi
  exit 0
fi
echo "✓ sitemap submitted to Search Console ($have URLs, gum profile $PROFILE)"
