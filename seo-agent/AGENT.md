# Daily SEO agent — runbook

Every morning a scheduled Claude Code task (Claude desktop app → Scheduled → `seo-agent-billtracker`)
works through this file in its own dedicated clone of the landing repo
`/Users/macbookpro/Documents/Bill Tracker/billtracker-landing-seo-agent` (branch `cloudflare`, which
is what Cloudflare Pages deploys). The owner's working copy (`…/billtracker-landing`, no suffix) is
never touched by the agent. It publishes **one** content item a day (plus, at most once every 6 days,
a home-page keyword tuning), in all 8 site languages (en uk hu nb de fr pt es), with no human
review — so the guardrails below are not optional.

| File | What it is |
|---|---|
| `plan.md` | **the content map**: page kinds, service pages to build in order, clusters, home-page targets |
| `config.json` | languages, markets, informational and commercial seed keywords |
| `pull-keywords.mjs` | Search Console (via [gum](https://gumcli.dev)) + Google & Bing autocomplete + what's published → brief |
| `FACTS.md` | the only product claims allowed |
| `validate.mjs` | guardrails; `publish.sh` won't push without it |
| `publish.sh` | validate → build → commit → push |
| `check-live.mjs` | after publishing: every touched URL is 200, new titles are live, new URLs are in the sitemap |
| `submit-sitemap.sh` | tells Search Console the sitemap changed; never fails a run |
| `log.md` | one line per run — read it first, append to it last |
| `data/` | daily keyword snapshots |
| `../blog/posts/<lang>/<slug>.md` | guides (blog posts) → `/<lang>/blog/<slug>/` |
| `../blog/pages/<lang>/<slug>.md` | service pages → `/<lang>/<slug>/` (English: `/<slug>/`) |
| `../blog/home/<lang>.json` | home-page strings you tune for keywords (whitelisted keys only) |
| `../blog/faq/<lang>.html` | homepage FAQ items you add (the build puts them on the home page and in its JSON-LD) |

## The run

1. **Sync.** `cd "/Users/macbookpro/Documents/Bill Tracker/billtracker-landing-seo-agent" && git checkout cloudflare && git pull --ff-only`.
   If the tree is dirty or the pull fails, stop and report — don't publish on top of unknown state.
   If `seo-agent/log.md` already has a content line (post, page, refresh, faq) for today, skip
   steps 4–6 for content; you may still do the home tuning (step 5c) if it is due.
2. **Read** `seo-agent/log.md`, `seo-agent/plan.md`, `seo-agent/FACTS.md`, and the newest English
   guide and (if any) service page — they are the reference for structure and tone.
3. **Pull keywords:** `node seo-agent/pull-keywords.mjs`. The brief has Search Console queries,
   informational autocomplete, **commercial** autocomplete (`… app`), refresh candidates, the home
   page's current title/H1/targets and what's published. If Search Console is UNAVAILABLE, or a
   language shows `NO DATA` / `⚠ failed requests`, carry on with what you have (Bing, then the seed
   keywords in `config.json`) and name the languages and errors in the log line and the report.
4. **Pick today's content item** — exactly one, in this order:
   1. **Service page**, if `plan.md` still has unbuilt rows and no service page was published in the
      last 2 days (check the log): build the next row. Service pages and guides alternate until the
      plan's pages exist.
   2. **Refresh**, if the brief lists a refresh candidate: improve that page for the queries it
      ranks 5–30 for (add a section or FAQ answering them, sharpen title/description), set
      `updated: <today>` in all 8 languages.
   3. **Guide** — one search intent, same topic in all languages (each language its own local
      phrasing). Prefer Search Console queries at position ~5–30 with low CTR and no page answering
      them, then rising queries, then autocomplete questions with clear intent that match the
      product. Pick from the cluster in `plan.md` with the fewest guides, so every service page gets
      supporting guides.
   4. **Homepage FAQ entry** — only for a short factual question best answered in 2–4 sentences
      ("does it need a bank login", "does it work offline"), at most **twice a week**.

   Skip anything already covered by a published page's main keyword or a homepage FAQ question
   (the validator refuses a main keyword that another key already uses in that language), anything
   the app can't honestly help with (FACTS: investing, debt payoff, taxes, bank sync, "who owes whom"
   bill splitting), and navigational queries for banks, other apps or government services.

5. **Write.**

   **General (all page kinds)**
   - English first, then each language written **natively, not translated word for word**:
     local currency and realistic household amounts (en: neutral numbers or $/£; uk: гривні;
     hu: forint; nb: kroner; de: Euro; fr: euros; pt: reais, Brazilian usage; es: euros, wording that
     also reads well in Mexico — `tú`, no `vosotros`), local habits and bills where they help
     (payday dates, Nebenkosten, rezsi, комуналка, feriepenger, décimo terceiro…), and the app's own
     words for its features, from `i18n/<lang>.json` (envelope, space, Premium).
   - **Keywords:** `keywords:` lists the 5–10 phrases you target; the **first one is the main
     keyword** for that language. Put it at the start of the title, in the first sentence (or the
     `lead`), and in at least one `##` heading — naturally, in the grammatical form the language
     needs. Put related phrases in other headings and the FAQ questions. No stuffing.
   - Check every sum: a table with a Total/Summe/Разом/Összesen… row must add up exactly (the
     validator checks it). No subtotal rows above a total.
   - Only claims from FACTS.md. No prices, no trial lengths, no financial, tax or investment advice,
     no invented statistics, no "In today's digital world", no filler intros.
   - Slug: the main local keyword in ASCII (transliterate uk, drop accents), lowercase-hyphen.

   **a) Service page** — `blog/pages/<lang>/<slug>.md`, same `key` in all 8 (the key from
   `plan.md`). It sells the app for one use case, honestly. Front matter:
   ```
   ---
   title: <main keyword first, ≤65 chars, e.g. "Budget App for Couples — One Shared Budget, No Bank Login">
   description: <110–160 chars>
   date: <today>
   key: couples-budget-app
   keywords: <main keyword>, <4–9 related commercial phrases>
   h1: <10–70 chars, contains the main keyword>
   lead: <80–260 chars: who it's for and the outcome, in plain words>
   navLabel: <≤40 chars, short link text for the footer, e.g. "Budget app for couples">
   eyebrow: <optional, ≤30 chars>
   screen: overview | sheet | insights
   order: <the row number from plan.md>
   ---
   ```
   Body (≥2,500 characters): 3–5 `##` sections on the problem and how the app solves it (features
   only as FACTS describes them, with a short real-life example in local currency), a "how to start
   in 3 steps" section, `{{app-cta}}` once, a section linking to the cluster's 1–3 best guides, and
   `## FAQ` with 3–6 `###` questions ending in `?` (they become FAQPage rich-result data). Mention
   Free vs Premium only as FACTS states it, no prices. No H1 in the body. A row of `plan.md` counts as built once
   its key is listed under "Service pages" in the brief.

   **b) Guide** — `blog/posts/<lang>/<slug>.md`, same `key` in all 8, front matter as the existing
   posts plus `cluster: <service page key from plan.md>`. Title ≤65 chars with the main keyword
   first; description 110–160 chars. Open with a 2–3 sentence direct answer, then `##` sections, a
   worked example with real numbers, `{{app-cta}}` once after the how-to part, and `## FAQ` with
   `###` questions. 900–1,500 words in English; similar depth elsewhere. Link in the body to the
   cluster's service page (if it exists) and 1–2 related guides in the same language
   (`/<lang>/blog/<slug>/`, English `/blog/<slug>/`; service pages `/<lang>/<slug>/`, English
   `/<slug>/`). The build adds "Read next" links both ways, so older guides link to new ones
   automatically — don't edit old guides just for links.

   **c) Home-page keyword tuning** — due when the brief says the home page was never tuned or
   was last tuned ≥14 days ago and Search Console (or the commercial autocomplete) shows a better
   head term; done **in addition** to the day's content item, never more than once every 6 days
   (the validator enforces it). Write `blog/home/<lang>.json` for **all 8 languages, with the same
   keys**:
   ```json
   {
     "_updated": "<today>",
     "_targets": ["<main head term>", "<2nd>", "<3rd>"],
     "meta_title": "Bill Tracker — <head term, natural> (30–65 chars, must contain Bill Tracker)",
     "meta_desc": "<110–160 chars with the head term and one secondary term>",
     "hero_h1": "<15–70 chars>",
     "hero_tagline": "<60–260 chars>"
   }
   ```
   Allowed keys: `meta_title meta_desc og_title hero_h1 hero_tagline features_h2 features_lead
   f1_h … f9_h screens_h2 screens_lead how_lead cta_h2 cta_lead` — anything else is refused. Start
   from the current strings in `i18n/<lang>.json` and change only what carries the keyword; keep
   the voice. Targets come from `plan.md` → *Home page targets* and the brief; the home page's main
   term must not be the main keyword of a service page in that language (service pages take the
   longer, more specific terms). Log it as its own line (`home`).

   **d) Refresh** — edit all 8 languages of one key, set `updated: <today>`, keep the slug.

   **e) Homepage FAQ entry** — append one item to each of the 8 files `blog/faq/<lang>.html`:
   ```html
   <details>
     <summary>Question as people search it?</summary>
     <p>Direct answer first, then one useful sentence. Plain text, &amp; escaped.</p>
   </details>
   ```
   12 agent items per language at most. Once there are 12, improve or replace a weak one instead.

6. **Check** before publishing:
   1. `node seo-agent/validate.mjs` and `npm run build`; fix until both pass. Fix every `⚠` warning
      you can; name the ones you leave in the report.
   2. **Second-pass review.** Start one subagent (Agent tool) with this brief: "Read
      `seo-agent/FACTS.md`, then every file changed in `git status` under `blog/`. List (a) any claim
      about the app that FACTS.md doesn't support, (b) any number or table that doesn't add up,
      (c) any price, trial length or financial advice, (d) any sentence in uk/hu/nb/de/fr/pt/es that
      reads like a literal translation or uses the wrong currency. Quote file and line." Fix
      everything it finds, then re-run the validator and build.
   Never edit `validate.mjs`, `publish.sh`, `check-live.mjs`, `submit-sitemap.sh`, `config.json`,
   `plan.md`, `FACTS.md`, `tools/`, `assets/`, `src/`, `i18n/` or any other page — if the task seems
   to need that, stop and report instead.
7. **Log** — append one line per item to `seo-agent/log.md`:
   `- <date> · <post|page|refresh|faq|home> · key=<key> · targets: <en keyword> (+ one per language) · source: <gsc|rising|autocomplete google|autocomplete bing|seeds> · <gsc ok|gsc unavailable>`
8. **Publish:** `seo-agent/publish.sh "SEO agent: <short title> (<date>)"` — one commit for the
   whole run.
9. **Verify live:** `node seo-agent/check-live.mjs` (waits up to 10 minutes for the deploy, checks
   every touched URL, the new home titles and the live sitemap). If it exits non-zero, say so in
   the report. Once the pages are live, run `seo-agent/submit-sitemap.sh`; if it says the deploy
   isn't live yet, run it once more a couple of minutes later. It never fails the run.
10. **Report** in 3–6 lines: what was published (URLs), the target keywords, the data source,
    whether the live check and sitemap submission passed, open warnings, and anything that needs a
    human (Search Console auth, a failed deploy).

If anything in steps 1–9 fails in a way you can't fix within the rules, **publish nothing** and
report why. A missed day is fine; a broken or wrong page is not.

## Search Console access

`gum` (v2.3.1, `~/.local/bin/gum`) has a **profile of its own for this site: `billtrackerx`**
(`config.json → gumProfile`), signed in to the owner's Google account through the OAuth client of
the Google Cloud project "billtrackerx" (client secret in the macOS Keychain, never in a file here).
Both scripts pass `--profile billtrackerx`. The **default** profile belongs to the
gpsandareameasure.com agent: never use it, log it in or out, or change it from here.

`pull-keywords.mjs` reads with `webmasters.readonly` and finds the billtrackerx.com property by host
(Domain or URL-prefix property, owner/full access only). Check:
`~/.local/bin/gum read searchconsole.sites.list --profile billtrackerx --output json`. If the
property is missing or Search Console is UNAVAILABLE, the agent runs on autocomplete alone and says so.

The **only** change the agent makes in Search Console is resubmitting the sitemap
(`submit-sitemap.sh`, `webmasters` scope). If either script reports a missing scope or an expired
sign-in, that needs the owner, once:
`~/.local/bin/gum auth login --profile billtrackerx --scope https://www.googleapis.com/auth/webmasters,https://www.googleapis.com/auth/webmasters.readonly`.
Never call any other Search Console write or destructive op (sites.add/delete, sitemaps.delete).
