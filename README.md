# billtrackerx.com — landing site

Static landing page for **Bill Tracker** (shared envelope budgeting for households).
Plain HTML/CSS/vanilla JS — no build step, no dependencies. Hosted on **GitHub Pages**.

> ⚠️ This repo is **public**. Everything committed here is world-readable —
> no secrets, no app code, no internal docs, ever.

## Structure

| Path | Purpose |
|---|---|
| `index.html` | Home: hero, features, how-it-works, waitlist |
| `join/` | Invite landing: `https://billtrackerx.com/join/?t=<token>` — Universal Link fallback with App Store button + copy-link flow |
| `privacy/`, `terms/` | Legal pages (drafts until app release) |
| `.well-known/apple-app-site-association` | Universal Links (appID `635LDGUSAA.com.billtrackerx.app`) |
| `assets/` | Stylesheet (tokens mirror the app design system), favicon, OG image |
| `CNAME` | Custom domain `billtrackerx.com` |
| `.nojekyll` | Required so GitHub Pages serves `.well-known/` (Jekyll drops dot-dirs) |

## Deploy

Every push to `main` deploys via GitHub Pages. One-time setup (repo Settings → Pages):

1. Source: **Deploy from a branch** → `main` / root.
2. Custom domain: `billtrackerx.com` (DNS: `A`/`ALIAS` records per GitHub docs, or `CNAME` for `www`).
3. Tick **Enforce HTTPS** (required for Universal Links).

After first deploy, validate the AASA file with Apple's CDN checker:
`https://app-site-association.cdn-apple.com/a/v1/billtrackerx.com` — if GitHub Pages
serves it incorrectly (wrong status/redirect), migrate to Cloudflare Pages (drop-in).

## TODO before launch (owners: PO)

- [ ] **Waitlist form**: create a [Formspree](https://formspree.io) form and replace `REPLACE_FORM_ID` in `index.html` (2 occurrences). Until then the form shows a friendly "opening soon" message instead of submitting.
- [ ] **Analytics**: register `billtrackerx.com` in [Plausible](https://plausible.io) (or swap the snippet for PostHog). The `?ref=` channel parameter is captured into the waitlist submission automatically.
- [ ] Replace the CSS phone mockup with real App Store screenshots once M4 assets exist.
- [ ] Legal pages are drafts — review before app release.
- [ ] Localized versions (hu/de/it/uk/es) come with the M4 translation batch.

## Conventions

- Design tokens in `assets/style.css` mirror the app (`AppColors` light/dark); one accent (`#00756A` / `#4DD6C5` dark), radius 12/16, spacing 4–32.
- Light **and** dark mode via `prefers-color-scheme` — check both before pushing.
- Invite URLs must stay `/join/?t=<token>` (query param — matches the app's Universal Link pattern and works on static hosting).
