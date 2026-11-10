# GitHub Pages → Cloudflare Pages: inventory taken 2026-11-11 (before any change)

## URLs on https://billtrackerx.com (GitHub Pages, English only)

| URL | Status | Content-Type | After cutover |
|---|---|---|---|
| `/` | 200 | text/html | 200 |
| `/uk/ /hu/ /nb/ /de/ /fr/ /pt/ /es/` | 404 | | 200 (new) |
| `/privacy/` `/terms/` `/join/` | 200 | text/html | 200 |
| `/join/abc` | 404 | | 404 |
| `/.well-known/apple-app-site-association` | 200 | application/octet-stream | 200, application/json |
| `/robots.txt` | 200 | text/plain | 200 |
| `/sitemap.xml` | 200 | application/xml | 200 |
| `/404.html`, any missing page | 200 / 404 | text/html | real 404 for missing pages |
| `/assets/style.css` | 200 | text/css | 200 |
| `/CNAME` `/.nojekyll` `/README.md` | 200 | | 404 (no longer published, on purpose) |
| `https://www.billtrackerx.com/` | 301 → apex | | 301 → apex (needs a redirect rule in Cloudflare) |

## DNS (from `dig`, public view — still to be cross-checked in the imena.com.ua panel)

Registrar: Internet Invest, Ltd. dba Imena.ua · expires 2027-07-03 · nameservers `ns*.srv53.{com,net,org}`

| Name | Type | Value |
|---|---|---|
| `billtrackerx.com` | A | 185.199.108.153, 185.199.109.153, 185.199.110.153, 185.199.111.153 (GitHub Pages — replaced by Pages) |
| `billtrackerx.com` | AAAA | 2606:50c0:8000::153 … 8003::153 (GitHub Pages — replaced by Pages) |
| `www` | A | 185.199.108.153 (GitHub Pages — replaced by Pages) |
| `billtrackerx.com` | MX | 10 mail.imena.com.ua. — **must be copied** |
| `billtrackerx.com` | TXT | none (no SPF) |
| `_dmarc`, `*._domainkey`, `mail`, `autodiscover` | | none found |
| CAA | | none |
