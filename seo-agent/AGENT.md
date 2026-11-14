# Daily SEO agent — runbook

Every morning a scheduled Claude Code task (Claude desktop app → Scheduled → `seo-agent-billtracker`)
works through this file in its own dedicated clone of the landing repo
`/Users/macbookpro/Documents/Bill Tracker/billtracker-landing-seo-agent` (branch `cloudflare`, which
is what Cloudflare Pages deploys). The owner's working copy (`…/billtracker-landing`, no suffix) is
never touched by the agent. It publishes **one** improvement a day, in all 8 site languages
(en uk hu nb de fr pt es), with no human review — so the guardrails below are not optional.

| File | What it is |
|---|---|
| `config.json` | languages, markets, seed keywords |
| `pull-keywords.mjs` | Search Console (via [gum](https://gumcli.dev)) + Google autocomplete + what's already published → brief |
| `FACTS.md` | the only product claims allowed |
| `validate.mjs` | guardrails; `publish.sh` won't push without it |
| `publish.sh` | validate → build → commit → push |
| `submit-sitemap.sh` | tells Search Console the sitemap changed (step 10); never fails a run |
| `log.md` | one line per run — read it first, append to it last |
| `data/` | daily keyword snapshots |
| `../blog/posts/<lang>/<slug>.md` | the posts |
| `../blog/faq/<lang>.html` | homepage FAQ items you add (the build puts them on the home page and in its JSON-LD) |

## The run

1. **Sync.** `cd "/Users/macbookpro/Documents/Bill Tracker/billtracker-landing-seo-agent" && git checkout cloudflare && git pull --ff-only`.
   If the tree is dirty or the pull fails, stop and report — don't publish on top of unknown state.
2. **Read** `seo-agent/log.md` (what was done before), `seo-agent/FACTS.md`, and
   `blog/posts/en/*.md` (house style; the newest one is the reference for structure and tone).
3. **Pull keywords:** `node seo-agent/pull-keywords.mjs`. If Search Console is UNAVAILABLE, carry on
   with autocomplete, and put the error in the log line and the final report.
4. **Pick today's target** — one search intent, the same topic for all languages (each language may
   target its own local phrasing of it). Prefer, in order:
   1. Search Console queries where we get impressions but sit at position ~5–30 with low CTR and no
      page that answers them directly.
   2. Rising queries.
   3. Autocomplete questions with clear intent that match the product: household and couple
      budgeting, the envelope method, tracking expenses by hand, budget categories, budgeting on an
      irregular income, shared money on a trip or in a flat-share, recurring bills, budgeting in more
      than one currency ("how to budget as a couple", "Umschlagmethode Kategorien",
      "borítékos módszer", "як вести сімейний бюджет", "método de los sobres").
   Skip anything already covered by a published `key` or homepage FAQ question, anything the app
   can't honestly help with (see FACTS: investing, debt payoff, taxes, bank-sync, bill splitting
   "who owes whom"), and navigational queries for banks, other apps or government services.
5. **Choose the format:**
   - **Blog post (default).** A full guide that answers the intent.
   - **Homepage FAQ entry** — only when the intent is a short factual question best answered in 2–4
     sentences ("does it need a bank login", "is it free", "does it work offline"), and at most
     **twice a week** (check the log). Append one item to each of the 8 files `blog/faq/<lang>.html`,
     nothing else:
     ```html
     <details>
       <summary>Question as people search it?</summary>
       <p>Direct answer first, then one useful sentence. Plain text, &amp; escaped.</p>
     </details>
     ```
     Never edit `src/`, `i18n/` or any generated page. 12 agent items per language at most. Once
     there are 12, improve or replace a weak one instead.
   - **Refresh** an existing post (add a section for a query it half-answers, set `updated: <today>`)
     when Search Console shows that post getting impressions for queries it doesn't cover. Change all
     languages of that key.
6. **Write.**
   - English first, then each language written **natively, not translated word for word**:
     - local currency and realistic household amounts in every example (en: neutral numbers or $/£;
       uk: гривні; hu: forint; nb: kroner; de: Euro; fr: euros; pt: reais, Brazilian usage; es: euros,
       wording that also reads well in Mexico — `tú`, no `vosotros`),
     - local habits and bills where they help (payday dates, Nebenkosten, rezsi, комуналка,
       feriepenger, décimo terceiro, prélèvement à la source…). These are colour, not app claims.
     - the app's own words for its features, from `i18n/<lang>.json` (envelope, space, Premium).
     - Check every sum: tables must add up to the totals you state.
   - Posts: `blog/posts/<lang>/<slug>.md`, same `key` in all 8, `date: <today>`, front matter as in
     the existing posts (title ≤65 chars with the main keyword first; description 110–160 chars;
     `keywords:` the 5–10 phrases you targeted in that language). Slug: the main local keyword in
     ASCII (transliterate uk, drop accents). No H1 in the body. Open with a 2–3 sentence direct
     answer, then `##` sections, a worked example with real numbers, `{{app-cta}}` once after the
     how-to part, and a short `## FAQ` with `###` questions. 900–1,500 words in English; similar
     depth elsewhere.
   - Link to 1–2 related existing posts in the same language (`/<lang>/blog/<slug>/`, English
     `/blog/<slug>/`) and to the homepage (`/<lang>/`, English `/`) where natural.
   - Only claims from FACTS.md. No prices, no financial, tax or investment advice, no invented
     statistics. Genuinely useful to someone running a household budget; no keyword stuffing, no
     filler intros, no "In today's digital world".
7. **Validate** with `node seo-agent/validate.mjs` and `npm run build`; fix until both pass. Never
   edit `validate.mjs`, `publish.sh`, `config.json`, `FACTS.md`, `tools/`, `assets/`, `src/`,
   `i18n/` or any other page — if the task seems to need that, stop and report instead.
8. **Log** — append one line to `seo-agent/log.md`:
   `- <date> · <post|faq|refresh> · key=<key> · targets: <en keyword> (+ one per language) · source: <gsc|rising|autocomplete> · <gsc ok|gsc unavailable>`
9. **Publish:** `seo-agent/publish.sh "SEO agent: <short title> (<date>)"`.
10. **Verify live** after ~3 minutes (`curl -s -o /dev/null -w '%{http_code}' <url>` for the English
    URL and one other language; retry a few times up to ~8 minutes). A 404 after that means the deploy
    failed — say so in the report. Once the pages are live, run `seo-agent/submit-sitemap.sh` so
    Google re-reads the sitemap and finds the new URLs. If it says the deploy isn't live yet, run it
    once more a couple of minutes later. It never fails the run: a `⚠` line just goes into the report.
11. **Report** in 3–5 lines: what was published (URLs), the target keywords, the data source,
    whether the sitemap was submitted, and anything that needs a human (Search Console auth, a
    failed deploy).

If anything in steps 1–10 fails in a way you can't fix within the rules, **publish nothing** and
report why. A missed day is fine; a broken or wrong page is not.

## Search Console access

`gum` (v2.3.1, `~/.local/bin/gum`) is signed in to the owner's Google account. `pull-keywords.mjs`
reads with `webmasters.readonly` and finds the billtrackerx.com property by host (Domain or
URL-prefix property, owner/full access only). Check:
`~/.local/bin/gum read searchconsole.sites.list --output json`. If the property is missing, the
agent runs on autocomplete alone and says so.

The **only** change the agent makes in Search Console is resubmitting the sitemap
(`submit-sitemap.sh`), which needs the `webmasters` scope. If that script reports `SCOPE_MISSING`,
the owner grants it once with
`~/.local/bin/gum auth login --scope https://www.googleapis.com/auth/webmasters,https://www.googleapis.com/auth/webmasters.readonly`.
Never call any other Search Console write or destructive op (sites.add/delete, sitemaps.delete).
