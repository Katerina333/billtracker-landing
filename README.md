# billtrackerx.com — landing site

Static landing page for **Bill Tracker** (shared envelope budgeting for households).
Plain HTML/CSS/vanilla JS plus a small Node build (`tools/build.mjs`, one dependency: `marked`).
Hosted on **Cloudflare Pages**, which runs `npm run build` and serves `dist/` on every push to
the **`cloudflare`** branch.

> ⚠️ Everything committed here should be treated as world-readable —
> no secrets, no app code, no internal docs, ever.

## Structure

| Path | Purpose |
|---|---|
| `src/index.html` | Home page template (`{{key}}` escaped, `{{{key}}}` raw) |
| `i18n/<lang>.json` | Home page strings; `en.json` is the source of truth |
| `tools/build.mjs` | Renders home pages, blog, RSS and `sitemap.xml` into `dist/` |
| `tools/i18n.mjs` | Languages (same set as the app) and blog UI strings |
| `blog/posts/<lang>/<slug>.md` | Blog posts; the same `key` in every language links translations |
| `blog/faq/<lang>.html` | Extra homepage FAQ items, written by the SEO agent |
| `seo-agent/` | Daily SEO agent: runbook (`AGENT.md`), product facts, guardrails, publish script |
| `assets/` | Styles (tokens mirror the app design system), `site.js` (App Store campaign links), screenshots per language |
| `join/` | Invite landing: `https://billtrackerx.com/join/?t=<token>` — Universal Link fallback. Localized in the browser, because the URL can't change |
| `privacy/`, `terms/` | Legal pages (English only) |
| `.well-known/apple-app-site-association` | Universal Links (appID `635LDGUSAA.com.billtrackerx.app`); `_headers` serves it as JSON |
| `_headers` | Cloudflare Pages response headers |

Home pages (`/`, `/uk/` … `/es/`) and `sitemap.xml` are **generated into `dist/` and not committed**.

## Editing

1. Home page copy: `i18n/en.json` **and** the same key in the 7 other `i18n/*.json` (the build stops
   if a language is missing a key). Layout: `src/index.html`.
2. `npm ci` once, then `npm run preview` → http://localhost:8642 . Check a couple of languages,
   light + dark, phone width.
3. After changing `assets/style.css`, `blog.css` or `site.js`, bump `ASSET_V` in `tools/build.mjs`
   and the `?v=` in `src/index.html` — `/assets/*` is cached for 24 h and a deploy doesn't purge it.
4. **Don't leave uncommitted edits in the clone the SEO agent uses** — it refuses to publish from
   a dirty tree and the day is skipped.

`node tools/build.mjs --no-v11` renders the home page without the app 1.1.0 features (`*_v11` keys,
`<!--v11-->` blocks). 1.1.0 has been live since 2026-09-29, so this is only a way back.

Language routing: English is at `/` (x-default), others at `/<lang>/`, all linked with
`hreflang`. On a first visit `/` redirects to the browser's language if we have it; a pick in
the language menu is remembered (`localStorage.bt_lang`) and wins over the browser.

App Store buttons carry `data-app-store`; `assets/site.js` rewrites them to Apple campaign links
(`…/app/apple-store/id6787081411?pt=128983894&ct=web_<lang>_<nav|hero|footer|blog>&mt=8`), visible in
App Store Connect → Analytics → Acquisition → Campaigns once a campaign has 5 installs.

## Deploy

Push to `cloudflare` → Cloudflare Pages builds (`npm run build`, output `dist`, `NODE_VERSION=22`)
and deploys in 1–3 minutes. When the app changes, update `seo-agent/FACTS.md` in the same release.

## TODO before launch (owners: PO)

- [x] App is live — waitlist removed, App Store buttons everywhere (2026-09-26).
- [x] Real localized app screenshots instead of the CSS mockup (2026-09-26).
- [x] Home + invite page in all 8 app languages (2026-09-26). Native-speaker review still wanted.
- [ ] **Analytics**: decide between Cloudflare Web Analytics and Plausible; today the pages load the Plausible snippet, but the site was never registered there. Original note: register `billtrackerx.com` in [Plausible](https://plausible.io) (or swap the snippet for PostHog). App Store clicks are sent as `appstore_click` with a `lang` prop.
- [ ] Apple's localized "Download on the App Store" badges — only the English SVG is in `assets/` today.
- [ ] Re-capture screenshots after 1.1.0 (the current set predates the new repeat button and "Remaining" labels).

## Conventions

- Design tokens in `assets/style.css` mirror the app (`AppColors` light/dark); one accent (`#00756A` / `#4DD6C5` dark), radius 12/16, spacing 4–32.
- Light **and** dark mode via `prefers-color-scheme` — check both before pushing.
- Invite URLs must stay `/join/?t=<token>` (query param — matches the app's Universal Link pattern and works on static hosting).
