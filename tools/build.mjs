// Builds the deployable site into dist/ (Cloudflare Pages runs `npm run build`):
//   1. copies static files as-is (assets, /join/, /privacy/, /terms/, /.well-known, 404, _headers),
//   2. renders the home page in every language from src/index.html + i18n/<lang>.json,
//      with the SEO agent's FAQ items (blog/faq/<lang>.html), the newest guides and JSON-LD,
//   3. renders the blog from blog/posts/<lang>/<slug>.md into /<lang>/blog/<slug>/ (English: /blog/),
//   4. writes sitemap.xml (with hreflang alternates) and one RSS feed per language.
//
// No framework on purpose. Template syntax in src/index.html: {{key}} is HTML-escaped, {{{key}}} raw.
// A key "foo_v11" replaces "foo" unless --no-v11 is passed; <!--v11-->…<!--/v11--> blocks are then
// dropped. (1.1.0 has been on the App Store since 2026-09-29, so the flag is only a way back.)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { marked } from "marked";
import { LANGS, homeURL, blogURL } from "./i18n.mjs";

const SITE = "https://billtrackerx.com";
const BRAND = "Bill Tracker";
const APPSTORE = "https://apps.apple.com/app/id6787081411";
const ASSET_V = "2";            // bump when assets/style.css, blog.css or site.js change (24 h edge cache)
const LEGAL_LASTMOD = "2026-08-11";
const V11 = !process.argv.includes("--no-v11");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");
const POSTS_DIR = path.join(ROOT, "blog", "posts");
const CODES = Object.keys(LANGS);
// Build inputs and GitHub Pages leftovers that must not be published.
const NOT_PUBLISHED = new Set(["tools", "blog", "seo-agent", "src", "i18n", "notes", "node_modules", "dist",
  "package.json", "package-lock.json", "README.md", "CNAME", ".nojekyll", ".gitignore", ".git",
  ".github", ".claude", ".DS_Store", "index.html", "sitemap.xml",
  ...CODES.filter((c) => LANGS[c].path).map((c) => LANGS[c].path)]);

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
const today = new Date().toISOString().slice(0, 10);
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");

// ---------------------------------------------------------------------------------------------
// 1. Static files

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });
for (const entry of fs.readdirSync(ROOT)) {
  if (NOT_PUBLISHED.has(entry)) continue;
  fs.cpSync(path.join(ROOT, entry), path.join(DIST, entry), {
    recursive: true, filter: (src) => path.basename(src) !== ".DS_Store",
  });
}

function writePage(url, html) {
  const dir = path.join(DIST, url);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), html);
}

// ---------------------------------------------------------------------------------------------
// Strings and posts

const strings = {};
const base = JSON.parse(read("i18n", "en.json"));
for (const code of CODES) {
  strings[code] = JSON.parse(read("i18n", `${code}.json`));
  const missing = Object.keys(base).filter((k) => !(k in strings[code]));
  if (missing.length) throw new Error(`i18n/${code}.json is missing keys: ${missing.join(", ")}`);
}
/** A home-page string, with its 1.1 variant when that is on. */
const t = (code, key) => {
  const S = strings[code];
  if (V11 && `${key}_v11` in S) return S[`${key}_v11`];
  if (!(key in S)) throw new Error(`missing string '${key}' for lang '${code}'`);
  return S[key];
};

/** Flat `key: value` front matter between --- fences, then the Markdown body. */
function parsePost(file) {
  const raw = fs.readFileSync(file, "utf8");
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) throw new Error(`${file}: missing front matter`);
  const meta = {};
  for (const line of m[1].split("\n")) {
    const i = line.indexOf(":");
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  for (const field of ["title", "description", "date", "key"]) {
    if (!meta[field]) throw new Error(`${file}: front matter needs "${field}"`);
  }
  return { ...meta, body: m[2] };
}

const posts = [];
for (const code of CODES) {
  const dir = path.join(POSTS_DIR, code);
  if (!fs.existsSync(dir)) continue;
  for (const name of fs.readdirSync(dir).filter((n) => n.endsWith(".md"))) {
    const slug = name.replace(/\.md$/, "");
    posts.push({ ...parsePost(path.join(dir, name)), lang: code, slug, url: `${blogURL(code)}${slug}/` });
  }
}
posts.sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));
const blogLangs = CODES.filter((code) => posts.some((p) => p.lang === code));
const translationsOf = (post) => posts.filter((p) => p.key === post.key);

// ---------------------------------------------------------------------------------------------
// Shared markup

const LOGO = `<svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
        <rect width="28" height="28" rx="8" fill="#00756A"/>
        <path d="M6 10.5 14 15l8-4.5M7.5 8h13A1.5 1.5 0 0 1 22 9.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 6 18.5v-9A1.5 1.5 0 0 1 7.5 8Z" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`;
const GLOBE = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 4 5.7 4 9s-1.5 6.4-4 9c-2.5-2.6-4-5.7-4-9s1.5-6.4 4-9Z"/></svg>`;
const BURGER = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>`;

const langItems = (code, hrefFor) => CODES.map((c) =>
  `          <li><a href="${hrefFor(c)}" hreflang="${LANGS[c].hreflang}" lang="${LANGS[c].hreflang}" data-lang="${c}"${
    c === code ? ' aria-current="true"' : ""}>${LANGS[c].label}</a></li>`).join("\n");

// One header for every page type. Section links are same-page anchors on the home page and
// point back to the home page everywhere else. The links collapse into a tap-to-open menu on
// phones (see .nav-menu in assets/style.css); the language switch target differs per page, so
// callers pass langHref.
function siteNav(code, { onHome, langHref }) {
  const L = LANGS[code];
  const base = onHome ? "" : homeURL(code);
  const links = [
    `<a class="nav-link" href="${base}#features">${esc(t(code, "nav_features"))}</a>`,
    `<a class="nav-link" href="${base}#how">${esc(t(code, "how_h2"))}</a>`,
    `<a class="nav-link" href="${base}#faq">${esc(t(code, "nav_faq"))}</a>`,
  ];
  if (blogLangs.includes(code)) links.push(`<a class="nav-link" href="${blogURL(code)}">${esc(L.blog)}</a>`);
  return `<nav class="site-nav" aria-label="Primary">
      <div class="nav-menu">
        <button type="button" class="nav-toggle" aria-label="${esc(L.menu)}" aria-expanded="false" aria-controls="nav-links">${BURGER}</button>
        <div class="nav-panel" id="nav-links">
          ${links.join("\n          ")}
        </div>
      </div>
      <details class="lang-menu">
        <summary aria-label="${esc(t(code, "lang_label"))}">
          ${GLOBE}
          <span>${code.toUpperCase()}</span>
        </summary>
        <ul>
${langItems(code, langHref)}
        </ul>
      </details>
      <a class="btn btn-primary btn-small" href="${APPSTORE}" data-app-store${onHome ? "" : ' data-location="blog"'}>${esc(t(code, "nav_download"))}</a>
    </nav>`;
}

function alternates(urlsByLang) {
  const links = Object.entries(urlsByLang).map(([c, url]) =>
    `  <link rel="alternate" hreflang="${LANGS[c].hreflang}" href="${SITE}${url}">`);
  if (urlsByLang.en) links.push(`  <link rel="alternate" hreflang="x-default" href="${SITE}${urlsByLang.en}">`);
  return links.join("\n");
}

const ldScript = (data) => `  <script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`;
const org = { "@type": "Organization", name: "ITPM Group", url: "https://itpmgroup.com" };
const formatDate = (code, iso) => new Date(`${iso}T12:00:00Z`)
  .toLocaleDateString(LANGS[code].hreflang, { year: "numeric", month: "long", day: "numeric" });
const decode = (s) => s.replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

// ---------------------------------------------------------------------------------------------
// 2. Home pages

// Only on the English root: send first-time visitors to their browser's language. An explicit pick
// in the language menu (localStorage bt_lang) always wins.
const REDIRECT_SCRIPT = `  <script>
    (function () {
      var supported = ${JSON.stringify(CODES)}, pick = null;
      try { pick = localStorage.getItem('bt_lang'); } catch (e) {}
      if (!pick) {
        var prefs = navigator.languages || [navigator.language || 'en'];
        for (var i = 0; i < prefs.length && !pick; i++) {
          var c = String(prefs[i]).toLowerCase().split('-')[0];
          if (c === 'no' || c === 'nn') c = 'nb';
          if (supported.indexOf(c) !== -1) pick = c;
        }
      }
      if (pick && pick !== 'en' && supported.indexOf(pick) !== -1) {
        location.replace('/' + pick + '/' + location.search + location.hash);
      }
    })();
  </script>`;

let template = read("src", "index.html")
  .replaceAll("/assets/style.css", `/assets/style.css?v=${ASSET_V}`);
template = V11 ? template.replaceAll("<!--v11-->\n", "").replaceAll("<!--/v11-->\n", "")
  : template.replace(/<!--v11-->[\s\S]*?<!--\/v11-->\n/g, "");
const homes = Object.fromEntries(CODES.map((c) => [c, homeURL(c)]));

/** Questions the SEO agent added for this language: [[question, answer], …] as plain text. */
function agentFaq(code) {
  const file = path.join(ROOT, "blog", "faq", `${code}.html`);
  const html = fs.existsSync(file) ? fs.readFileSync(file, "utf8").replace(/<!--[\s\S]*?-->/g, "") : "";
  const items = [...html.matchAll(/<details>\s*<summary>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/g)];
  return { html: items.map((m) => `        ${m[0].replace(/\s*\n\s*/g, " ")}\n`).join(""),
    pairs: items.map(([, q, a]) => [decode(q), decode(a)]) };
}

for (const code of CODES) {
  const L = LANGS[code];
  const faq = agentFaq(code);
  const latest = posts.filter((p) => p.lang === code).slice(0, 3);
  const hasBlog = blogLangs.includes(code);

  const jsonLd = [{
    "@context": "https://schema.org", "@type": "SoftwareApplication", name: BRAND,
    description: t(code, "meta_desc"), url: `${SITE}${homeURL(code)}`, inLanguage: L.hreflang,
    applicationCategory: "FinanceApplication", operatingSystem: "iOS 15.0 or later",
    downloadUrl: APPSTORE, image: `${SITE}/assets/og-image.png`,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" }, publisher: org,
  }, {
    "@context": "https://schema.org", "@type": "FAQPage", inLanguage: L.hreflang,
    mainEntity: [...[1, 2, 3, 4, 5].map((n) => [t(code, `q${n}`), t(code, `a${n}`)]), ...faq.pairs]
      .map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
  }];

  const computed = {
    lang: L.hreflang, lang_short: code.toUpperCase(), url: `${SITE}${homeURL(code)}`, home: homeURL(code),
    og_locale: L.ogLocale, appstore_url: APPSTORE,
    hreflang: alternates(homes),
    nav: siteNav(code, { onHome: true, langHref: homeURL }),
    redirect_script: code === "en" ? REDIRECT_SCRIPT : "",
    json_ld: jsonLd.map(ldScript).join("\n"),
    rss_link: hasBlog ? `  <link rel="alternate" type="application/rss+xml" title="${esc(L.blogTitle)}" href="${SITE}${blogURL(code)}rss.xml">\n` : "",
    blog_nav: hasBlog ? `      <a class="nav-link" href="${blogURL(code)}">${esc(L.blog)}</a>\n` : "",
    blog_footer: hasBlog ? `      <a href="${blogURL(code)}">${esc(L.blog)}</a>\n` : "",
    agent_faq: faq.html,
    latest_guides: latest.length ? `  <section class="section" id="guides">
    <div class="wrap">
      <h2>${esc(L.blogTitle)}</h2>
      <ul class="guide-list">
${latest.map((p) => `        <li><a href="${p.url}"><strong>${esc(p.title)}</strong><span>${esc(p.description)}</span></a></li>`).join("\n")}
      </ul>
      <p class="guide-all"><a href="${blogURL(code)}">${esc(L.allPosts)} →</a></p>
    </div>
  </section>

` : "",
  };
  // Screenshot folders are named by language code, which is also what {{lang}} was before hreflang.
  const value = (key) => (key in computed ? computed[key] : t(code, key));
  const html = template
    .replaceAll("/assets/screens/{{lang}}/", `/assets/screens/${code}/`)
    .replace(/\{\{\{(\w+)\}\}\}/g, (_, k) => value(k))
    .replace(/\{\{(\w+)\}\}/g, (_, k) => esc(value(k)));
  writePage(homeURL(code), html);
}

// ---------------------------------------------------------------------------------------------
// 3. Blog

const storeBadge = (code) => `<a class="appstore-badge" href="${APPSTORE}" data-app-store data-location="blog">
    <img src="/assets/appstore-badge.svg" alt="${esc(t(code, "appstore_alt"))}" height="48" loading="lazy">
  </a>`;
const ctaBox = (code) => `<aside class="post-cta">
  <h2>${esc(LANGS[code].ctaTitle)}</h2>
  <p>${esc(LANGS[code].ctaText)}</p>
  ${storeBadge(code)}
</aside>`;

function page({ code, title, description, url, alternatesByLang, menuHref, jsonLd, main, ogType }) {
  const L = LANGS[code];
  return `<!doctype html>
<html lang="${L.hreflang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <meta name="robots" content="index, follow, max-image-preview:large">
  <link rel="canonical" href="${SITE}${url}">
${alternates(alternatesByLang)}
  <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
  <link rel="stylesheet" href="/assets/style.css?v=${ASSET_V}">
  <link rel="stylesheet" href="/assets/blog.css?v=${ASSET_V}">
  <meta name="apple-itunes-app" content="app-id=6787081411">
  <meta property="og:type" content="${ogType}">
  <meta property="og:site_name" content="${BRAND}">
  <meta property="og:url" content="${SITE}${url}">
  <meta property="og:locale" content="${L.ogLocale}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:image" content="${SITE}/assets/og-image.png">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="alternate" type="application/rss+xml" title="${esc(L.blogTitle)}" href="${SITE}${blogURL(code)}rss.xml">
${[].concat(jsonLd).map(ldScript).join("\n")}
  <script defer data-domain="billtrackerx.com" src="https://plausible.io/js/script.js"></script>
</head>
<body>

<header class="site-header">
  <div class="wrap">
    <a class="brand" href="${homeURL(code)}">
      ${LOGO}
      ${BRAND}
    </a>
    ${siteNav(code, { onHome: false, langHref: menuHref })}
  </div>
</header>

${main}

<footer class="site-footer">
  <div class="wrap">
    <span>© <span class="js-year">${new Date().getFullYear()}</span> ${BRAND}</span>
    <nav>
      <a href="${homeURL(code)}">${esc(L.home)}</a>
      <a href="${blogURL(code)}">${esc(L.blog)}</a>
      <a href="/privacy/">${esc(t(code, "footer_privacy"))}</a>
      <a href="/terms/">${esc(t(code, "footer_terms"))}</a>
    </nav>
  </div>
</footer>

<script src="/assets/site.js?v=${ASSET_V}" defer></script>
</body>
</html>
`;
}

for (const post of posts) {
  const L = LANGS[post.lang];
  const siblings = Object.fromEntries(translationsOf(post).map((p) => [p.lang, p.url]));
  const body = marked.parse(post.body).replace(/<p>\{\{app-cta\}\}<\/p>/, ctaBox(post.lang))
    .replace(/<table>/g, '<div class="table-scroll"><table>').replace(/<\/table>/g, "</table></div>");
  const main = `<main class="post">
  <nav class="breadcrumbs" aria-label="breadcrumb"><a href="${homeURL(post.lang)}">${esc(L.home)}</a> › <a href="${blogURL(post.lang)}">${esc(L.blog)}</a></nav>
  <article>
    <h1>${esc(post.title)}</h1>
    <p class="post-meta">${esc(L.published)} <time datetime="${post.date}">${formatDate(post.lang, post.date)}</time></p>
    ${body}
  </article>
  <p class="post-back"><a href="${blogURL(post.lang)}">← ${esc(L.allPosts)}</a></p>
</main>`;
  const jsonLd = [{
    "@context": "https://schema.org", "@type": "BlogPosting",
    headline: post.title, description: post.description, inLanguage: L.hreflang,
    datePublished: post.date, dateModified: post.updated || post.date,
    image: `${SITE}/assets/og-image.png`, author: org, publisher: org,
    mainEntityOfPage: `${SITE}${post.url}`,
    ...(post.keywords ? { keywords: post.keywords } : {}),
  }, {
    "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: L.home, item: `${SITE}${homeURL(post.lang)}` },
      { "@type": "ListItem", position: 2, name: L.blog, item: `${SITE}${blogURL(post.lang)}` },
      { "@type": "ListItem", position: 3, name: post.title, item: `${SITE}${post.url}` },
    ],
  }];
  writePage(post.url, page({
    code: post.lang, title: post.title, description: post.description, url: post.url,
    alternatesByLang: siblings, jsonLd, main, ogType: "article",
    // Switching language on an article goes to its translation, else to that language's blog.
    menuHref: (c) => siblings[c] || (blogLangs.includes(c) ? blogURL(c) : homeURL(c)),
  }));
}

for (const code of blogLangs) {
  const L = LANGS[code];
  const own = posts.filter((p) => p.lang === code);
  const main = `<main class="post blog-index">
  <h1>${esc(L.blogTitle)}</h1>
  <p class="lead">${esc(L.blogIntro)}</p>
  <ul class="post-list">
${own.map((p) => `    <li class="post-card">
      <a href="${p.url}"><h2>${esc(p.title)}</h2></a>
      <p>${esc(p.description)}</p>
      <p class="post-meta"><time datetime="${p.date}">${formatDate(code, p.date)}</time> · <a href="${p.url}">${esc(L.readMore)} →</a></p>
    </li>`).join("\n")}
  </ul>
</main>`;
  const menuHref = (c) => (blogLangs.includes(c) ? blogURL(c) : homeURL(c));
  writePage(blogURL(code), page({
    code, title: `${L.blogTitle} — ${BRAND}`, description: L.blogIntro, url: blogURL(code),
    alternatesByLang: Object.fromEntries(blogLangs.map((c) => [c, blogURL(c)])), ogType: "website", main,
    jsonLd: { "@context": "https://schema.org", "@type": "Blog", name: L.blogTitle,
      inLanguage: L.hreflang, url: `${SITE}${blogURL(code)}`, publisher: org },
    menuHref,
  }));

  fs.writeFileSync(path.join(DIST, blogURL(code), "rss.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${esc(L.blogTitle)} — ${BRAND}</title>
    <link>${SITE}${blogURL(code)}</link>
    <description>${esc(L.blogIntro)}</description>
    <language>${L.hreflang}</language>
${own.map((p) => `    <item>
      <title>${esc(p.title)}</title>
      <link>${SITE}${p.url}</link>
      <guid>${SITE}${p.url}</guid>
      <pubDate>${new Date(`${p.date}T12:00:00Z`).toUTCString()}</pubDate>
      <description>${esc(p.description)}</description>
    </item>`).join("\n")}
  </channel>
</rss>
`);
}

// ---------------------------------------------------------------------------------------------
// 4. Sitemap — every home page, blog index, article and legal page, with hreflang alternates.
// /join/ is left out on purpose (robots.txt disallows it).

const urlEntry = (loc, lastmod, alts = {}) => {
  const links = Object.entries(alts).map(([c, u]) =>
    `\n    <xhtml:link rel="alternate" hreflang="${LANGS[c].hreflang}" href="${SITE}${u}" />`).join("");
  const xdef = alts.en ? `\n    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE}${alts.en}" />` : "";
  return `  <url>\n    <loc>${SITE}${loc}</loc>\n    <lastmod>${lastmod}</lastmod>${links}${xdef}\n  </url>`;
};
const blogs = Object.fromEntries(blogLangs.map((c) => [c, blogURL(c)]));
// Home pages change when the copy, a guide or an agent FAQ item does; the newest post date is a
// truthful floor that doesn't claim a change on every build.
const homeMod = posts[0]?.date || today;
const entries = [
  ...CODES.map((c) => urlEntry(homeURL(c), homeMod, homes)),
  ...blogLangs.map((c) => urlEntry(blogURL(c), posts.find((p) => p.lang === c).date, blogs)),
  ...posts.map((p) => urlEntry(p.url, p.updated || p.date,
    Object.fromEntries(translationsOf(p).map((x) => [x.lang, x.url])))),
  urlEntry("/privacy/", LEGAL_LASTMOD),
  urlEntry("/terms/", LEGAL_LASTMOD),
];
fs.writeFileSync(path.join(DIST, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries.join("\n")}
</urlset>
`);

console.log(`Built ${CODES.length} home pages, ${posts.length} posts in ${blogLangs.length} languages, `
  + `${entries.length} sitemap URLs → dist/${V11 ? "" : " (without 1.1 features)"}`);
