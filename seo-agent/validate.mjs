// Guardrails for the SEO agent's uncommitted changes. publish.sh refuses to push unless this passes.
//
// The agent may only:
//   - add or edit blog posts (blog/posts/<lang>/<slug>.md), every key present in all languages,
//   - add or edit service pages (blog/pages/<lang>/<slug>.md, rendered at /<lang>/<slug>/), same rule,
//   - add homepage FAQ items to blog/faq/<lang>.html (the build puts them on the home page and
//     into its FAQPage JSON-LD),
//   - tune whitelisted home-page strings in blog/home/<lang>.json (HOME_SEO_KEYS in tools/i18n.mjs),
//     at most once every 6 days,
//   - write its own files (seo-agent/data/**, seo-agent/log.md).
// Everything else on the site is hand-written and must stay byte-identical.
//
// Errors block publishing. Warnings (⚠) are printed for the agent to fix or mention in its report.
//
// Usage: node seo-agent/validate.mjs

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { HOME_SEO_KEYS, RESERVED_SLUGS } from "../tools/i18n.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LANGS = Object.keys(JSON.parse(fs.readFileSync(path.join(ROOT, "seo-agent", "config.json"), "utf8")).langs);
const git = (...args) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8" });
const headVersion = (file) => {
  try {
    return execFileSync("git", ["show", `HEAD:./${file}`], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch { return null; }
};
const today = new Date().toISOString().slice(0, 10);

const errors = [];
const warnings = [];
const fail = (file, msg) => errors.push(`${file}: ${msg}`);
const warn = (file, msg) => warnings.push(`${file}: ${msg}`);
const len = (s) => [...(s || "")].length;
const daysBetween = (a, b) => Math.round((Date.parse(a) - Date.parse(b)) / 864e5);

const changed = [...new Set([
  ...git("diff", "--name-only", "--relative", "HEAD").split("\n"),
  ...git("ls-files", "--others", "--exclude-standard").split("\n"),
].filter(Boolean))];

const FAQ = /^blog\/faq\/([a-z]{2})\.html$/;
const POST = /^blog\/posts\/([a-z]{2})\/([^/]+)\.md$/;
const SPAGE = /^blog\/pages\/([a-z]{2})\/([^/]+)\.md$/;
const HOME = /^blog\/home\/([a-z]{2})\.json$/;
const allowed = (f) => POST.test(f) || SPAGE.test(f) || (FAQ.test(f) && LANGS.includes(f.match(FAQ)[1]))
  || (HOME.test(f) && LANGS.includes(f.match(HOME)[1]))
  || f === "seo-agent/log.md" || f.startsWith("seo-agent/data/");

for (const f of changed) if (!allowed(f)) fail(f, "the agent may not change this file");

// ---------------------------------------------------------------------------------------------
// Homepage FAQ fragments: one file per language, holding nothing but simple FAQ items.

const ALLOWED_TAGS = new Set(["details", "summary", "p", "strong", "em", "ul", "ol", "li", "a", "br"]);
const faqCount = {};

for (const code of LANGS) {
  const f = `blog/faq/${code}.html`;
  if (!fs.existsSync(path.join(ROOT, f))) { fail(f, "missing — every language needs its FAQ file"); continue; }
  const region = fs.readFileSync(path.join(ROOT, f), "utf8").replace(/<!--[\s\S]*?-->/g, "");
  const stack = [];
  for (const t of region.matchAll(/<(\/?)([a-zA-Z0-9]+)([^>]*)>/g)) {
    const [, close, tag, attrs] = t;
    const name = tag.toLowerCase();
    if (!ALLOWED_TAGS.has(name)) { fail(f, `tag <${name}> not allowed in the FAQ`); continue; }
    if (/\son\w+=|style=|javascript:/i.test(attrs)) fail(f, `attribute not allowed: <${name}${attrs}>`);
    if (name === "a" && !close && !/^\s*href="[\/#][^"]*"\s*$/.test(attrs)) fail(f, `links in the FAQ must be internal: <a${attrs}>`);
    else if (name !== "a" && !close && attrs.trim() && attrs.trim() !== "/") fail(f, `no attributes allowed: <${name}${attrs}>`);
    if (name === "br") continue;
    if (!close) stack.push(name);
    else if (stack.pop() !== name) fail(f, `unbalanced </${name}> in the FAQ`);
  }
  if (stack.length) fail(f, `unclosed tags in the FAQ: ${stack.join(", ")}`);
  const items = [...region.matchAll(/<details>\s*<summary>([\s\S]*?)<\/summary>\s*<p>[\s\S]*?<\/p>\s*<\/details>/g)];
  const loose = region.replace(/<details>\s*<summary>[\s\S]*?<\/summary>\s*<p>[\s\S]*?<\/p>\s*<\/details>/g, "").trim();
  if (loose) fail(f, "the file may only contain <details><summary>…</summary><p>…</p></details> items");
  for (const [m, q] of items) {
    if ([...q].length > 140) fail(f, `question too long (${[...q].length} chars): ${q}`);
    if ([...m].length > 900) fail(f, `FAQ item too long (${[...m].length} chars, max 900): ${q}`);
  }
  if (items.length > 12) fail(f, `${items.length} agent FAQ items — the cap is 12; improve existing ones instead`);
  faqCount[code] = items.length;
}
if (new Set(Object.values(faqCount)).size > 1) {
  errors.push(`homepage FAQ items differ between languages (every question needs all translations): ${JSON.stringify(faqCount)}`);
}

// ---------------------------------------------------------------------------------------------
// Home-page keyword tuning: blog/home/<lang>.json

const HOME_LIMITS = { meta_title: [30, 65], meta_desc: [110, 160], og_title: [20, 70], hero_h1: [15, 70],
  hero_tagline: [60, 260], features_h2: [10, 70], features_lead: [60, 260], screens_h2: [8, 60],
  screens_lead: [30, 200], how_lead: [20, 160], cta_h2: [10, 70], cta_lead: [10, 160] };
const homeChanged = changed.filter((f) => HOME.test(f));
if (homeChanged.length) {
  const keySets = {};
  for (const code of LANGS) {
    const f = `blog/home/${code}.json`;
    if (!fs.existsSync(path.join(ROOT, f))) { fail(f, "missing — tune the home page in all languages at once"); continue; }
    let data;
    try { data = JSON.parse(fs.readFileSync(path.join(ROOT, f), "utf8")); } catch (e) { fail(f, `not valid JSON: ${e.message}`); continue; }
    if (!data || typeof data !== "object" || Array.isArray(data)) { fail(f, "must be a JSON object"); continue; }
    const keys = Object.keys(data).filter((k) => !k.startsWith("_"));
    keySets[code] = keys.sort().join(",");
    for (const k of keys) {
      const v = data[k];
      if (!HOME_SEO_KEYS.includes(k)) { fail(f, `key "${k}" may not be tuned (allowed: ${HOME_SEO_KEYS.join(", ")})`); continue; }
      if (typeof v !== "string" || !v.trim()) { fail(f, `"${k}" must be a non-empty string`); continue; }
      if (/[<>]|\{\{|https?:/.test(v)) fail(f, `"${k}": no HTML, template tags or URLs`);
      const [min, max] = HOME_LIMITS[k] || (/_h$/.test(k) ? [4, 50] : [10, 200]);
      if (len(v) < min || len(v) > max) fail(f, `"${k}" is ${len(v)} chars (${min}–${max})`);
    }
    if (data.meta_title && !data.meta_title.includes("Bill Tracker")) fail(f, `meta_title must contain the brand "Bill Tracker"`);
    if (changed.includes(f) && data._updated !== today) fail(f, `set "_updated": "${today}"`);
    if (!Array.isArray(data._targets) || !data._targets.length) fail(f, `"_targets" must list the 2–5 keywords this language's home page targets`);
  }
  if (new Set(Object.values(keySets)).size > 1) errors.push(`blog/home: every language must tune the same keys: ${JSON.stringify(keySets)}`);
  // Rankings need time to settle; changing the home page every day makes Search Console data useless.
  const last = git("log", "-1", "--format=%cs", "--", "blog/home").trim();
  if (last && daysBetween(today, last) < 6) errors.push(`blog/home was last changed on ${last} — at most once every 6 days`);
}

// ---------------------------------------------------------------------------------------------
// Posts and service pages

function parse(file) {
  const raw = fs.readFileSync(path.join(ROOT, file), "utf8");
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return null;
  const meta = {};
  for (const line of m[1].split("\n")) {
    const i = line.indexOf(":");
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return { meta, body: m[2] };
}

function collect(kind, dirName) {
  const out = [];
  for (const code of LANGS) {
    const dir = path.join(ROOT, "blog", dirName, code);
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir).filter((n) => n.endsWith(".md"))) {
      const file = `blog/${dirName}/${code}/${name}`;
      out.push({ kind, file, lang: code, slug: name.slice(0, -3), post: parse(file) });
    }
  }
  return out;
}
const allPosts = collect("post", "posts");
const allPages = collect("page", "pages");
const allContent = [...allPosts, ...allPages];

// Totals in Markdown tables must add up: the rows above a "Total" row, per numeric column.
const TOTAL_WORDS = ["total", "totals", "sum", "summe", "gesamt", "insgesamt", "разом", "усього", "всього", "összesen",
  "összes", "totalt", "totale", "somme", "soma", "suma", "en tout", "itogo"];
function parseAmount(cell) {
  const c = cell.replace(/[*_`]/g, "").trim();
  if (!c || /%|=|×|\bx\s*\d|\d\s*[–—-]\s*\d|\//.test(c)) return null;
  const nums = c.match(/[-−]?\d[\d\s  .,']*\d|[-−]?\d/g);
  if (!nums || nums.length !== 1) return null;
  let tok = nums[0].replace(/[\s  ']/g, "").replace("−", "-");
  if (/[.,]\d{1,2}$/.test(tok)) {
    const dec = tok.slice(-3).replace(/^[.,]/, "").length;
    tok = tok.slice(0, tok.length - dec - 1).replace(/[.,]/g, "") + "." + tok.slice(-dec);
  } else tok = tok.replace(/[.,]/g, "");
  const n = Number(tok);
  return Number.isFinite(n) ? n : null;
}
function checkTables(file, body) {
  const lines = body.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].trim().startsWith("|")) continue;
    const block = [];
    while (i < lines.length && lines[i].trim().startsWith("|")) block.push(lines[i++]);
    const rows = block.filter((l) => !/^\s*\|[\s|:-]+\|\s*$/.test(l))
      .map((l) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim()));
    const ti = rows.findIndex((r, k) => k > 0 && TOTAL_WORDS.some((w) => new RegExp(`^${w}(?![\\p{L}])`, "u").test(r[0].replace(/[*_]/g, "").trim().toLowerCase())));
    if (ti < 2) continue;
    const head = rows[0], body = rows.slice(1, ti), total = rows[ti];
    for (let c = 1; c < head.length; c++) {
      if (/%/.test(head[c])) continue;
      const want = parseAmount(total[c] || "");
      const vals = body.map((r) => parseAmount(r[c] || ""));
      if (want === null || vals.some((v) => v === null)) continue;
      const sum = vals.reduce((a, b) => a + b, 0);
      if (Math.abs(sum - want) > 1) fail(file, `table "${head[c] || "column " + c}": rows add up to ${+sum.toFixed(2)}, the ${total[0].replace(/[*_]/g, "")} row says ${want} (no subtotal rows above a total, please)`);
    }
  }
}

const primary = (p) => (p.post?.meta.keywords || "").split(",")[0].trim().toLowerCase();
const touchedKeys = { post: new Set(), page: new Set() };
for (const f of changed.filter((f) => (POST.test(f) || SPAGE.test(f)) && fs.existsSync(path.join(ROOT, f)))) {
  const isPage = SPAGE.test(f);
  const [, lang, slug] = f.match(isPage ? SPAGE : POST);
  if (!LANGS.includes(lang)) { fail(f, `unknown language "${lang}"`); continue; }
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length > 70) fail(f, "slug must be lowercase ASCII words joined by hyphens, ≤70 chars");
  if (isPage && RESERVED_SLUGS.has(slug)) fail(f, `slug "${slug}" is reserved for the site's own folders`);
  const p = parse(f);
  if (!p) { fail(f, "missing --- front matter ---"); continue; }
  const { meta, body } = p;
  const need = isPage ? ["title", "description", "date", "key", "keywords", "h1", "lead"] : ["title", "description", "date", "key", "keywords", "cluster"];
  for (const k of need) if (!meta[k]) fail(f, `front matter needs "${k}"`);
  if (len(meta.title) > 65 || len(meta.title) < 20) fail(f, `title is ${len(meta.title)} chars (20–65)`);
  if (len(meta.description) > 160 || len(meta.description) < 110) fail(f, `description is ${len(meta.description)} chars (110–160)`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(meta.date || "") || meta.date > today) fail(f, `bad or future date "${meta.date}"`);
  if (meta.updated && (!/^\d{4}-\d{2}-\d{2}$/.test(meta.updated) || meta.updated > today)) fail(f, `bad updated "${meta.updated}"`);
  if (isPage) {
    if (len(meta.h1) > 70 || len(meta.h1) < 10) fail(f, `h1 is ${len(meta.h1)} chars (10–70)`);
    if (len(meta.lead) > 260 || len(meta.lead) < 80) fail(f, `lead is ${len(meta.lead)} chars (80–260)`);
    if (meta.screen && !["overview", "sheet", "insights"].includes(meta.screen)) fail(f, `screen must be overview, sheet or insights`);
    if (meta.navLabel && len(meta.navLabel) > 40) fail(f, `navLabel is ${len(meta.navLabel)} chars (≤40)`);
    if (meta.order && !/^\d{1,2}$/.test(meta.order)) fail(f, `order must be a number`);
  }
  if (/^#\s/m.test(body)) fail(f, "no H1 in the body — the title is the H1; start sections at ##");
  if ((body.match(/^\{\{app-cta\}\}$/gm) || []).length !== 1) fail(f, "{{app-cta}} must appear exactly once, on its own line");
  const minBody = isPage ? 2500 : 3000;
  if (len(body) < minBody) fail(f, `body is only ${len(body)} chars (min ${minBody}) — too thin to publish`);
  if (/<script|<iframe|<style|javascript:/i.test(body)) fail(f, "raw script/iframe/style is not allowed");
  for (const [, url] of body.matchAll(/\]\(([^)\s]+)/g)) {
    if (!/^(\/|https:\/\/|#)/.test(url)) fail(f, `link must be internal (/…), https or #anchor: ${url}`);
  }
  // Unicode-aware boundaries, and TODO/TBD case-sensitive: "método" and "sobre todo" are ordinary words.
  if (/(?<![\p{L}\p{N}_])(?:TODO|TBD)(?![\p{L}\p{N}_])/u.test(body) || /(?<![\p{L}\p{N}_])(?:lorem ipsum|as an ai)(?![\p{L}\p{N}_])/iu.test(body)) fail(f, "placeholder or AI boilerplate left in the text");
  checkTables(f, body);
  if (!/^## .*\n+### .*[?？]\s*$/m.test(body) && !/^### .*[?？]\s*$/m.test(body)) warn(f, "no FAQ (### questions ending in ?) — they become FAQPage rich-result data");
  if (!/\]\(\/[^)]*\)/.test(body)) warn(f, "no internal link in the body");
  // Keyword placement: inflected languages won't always match literally, so this only warns.
  const kw = primary({ post: p });
  const stem = kw.split(/\s+/).filter((w) => w.length > 3).map((w) => w.slice(0, Math.max(4, w.length - 2)));
  const has = (text) => stem.every((w) => (text || "").toLowerCase().includes(w));
  if (kw && !has(meta.title)) warn(f, `main keyword "${kw}" isn't in the title`);
  if (kw && !has(body.split("\n\n")[0] + (meta.lead || ""))) warn(f, `main keyword "${kw}" isn't in the opening`);
  // Cannibalization: one main keyword per language belongs to one key.
  for (const other of allContent) {
    if (other.lang === lang && other.post?.meta.key !== meta.key && kw && primary(other) === kw) {
      fail(f, `main keyword "${kw}" is already the main keyword of ${other.file} — pick another intent or refresh that page`);
    }
  }
  if (meta.key) touchedKeys[isPage ? "page" : "post"].add(meta.key);
}

for (const [kind, keys] of Object.entries(touchedKeys)) {
  const pool = kind === "page" ? allPages : allPosts;
  for (const key of keys) {
    const group = pool.filter((p) => p.post?.meta.key === key);
    for (const code of LANGS) {
      const n = group.filter((p) => p.lang === code).length;
      if (n === 0) errors.push(`${kind} key "${key}": no ${code} version — every ${kind} needs all ${LANGS.length} languages`);
      if (n > 1) errors.push(`${kind} key "${key}": ${n} ${code} files share it`);
    }
  }
}
const pageKeys = new Set(allPages.map((p) => p.post?.meta.key));
if (pageKeys.size > 15) errors.push(`${pageKeys.size} service pages — the cap is 15; improve existing ones instead`);
for (const p of allPosts.filter((p) => changed.includes(p.file))) {
  const c = p.post?.meta.cluster;
  if (c && !pageKeys.has(c) && !/^[a-z0-9-]+$/.test(c)) fail(p.file, `cluster "${c}" must be a service page key (lowercase-hyphen)`);
}

// One new article or service page per day keeps a runaway run from flooding the site.
const newKeysToday = new Set(allContent.filter((p) => changed.includes(p.file) && !headVersion(p.file)
  && p.post?.meta.date === today).map((p) => `${p.kind}:${p.post.meta.key}`));
const existingKeys = new Set(allContent.filter((p) => headVersion(p.file)).map((p) => `${p.kind}:${p.post?.meta.key}`));
const reallyNew = [...newKeysToday].filter((k) => !existingKeys.has(k));
if (reallyNew.length > 1) errors.push(`${reallyNew.length} new pages in one run (${reallyNew.join(", ")}) — publish one per day`);

// Posts live under /blog/, service pages at the language root; slugs must be unique within each.
for (const pool of [allPosts, allPages]) {
  const slugs = pool.map((p) => `${p.lang}/${p.slug}`);
  if (new Set(slugs).size !== slugs.length) errors.push("duplicate slug within a language");
}

for (const w of warnings) console.warn(`⚠ ${w}`);
if (errors.length) {
  console.error(`✗ ${errors.length} problem(s):\n- ${errors.join("\n- ")}`);
  process.exit(1);
}
console.log(`✓ valid — ${changed.length} changed file(s): ${changed.join(", ") || "none"}${warnings.length ? ` · ${warnings.length} warning(s) above` : ""}`);
