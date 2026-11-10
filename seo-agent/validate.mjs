// Guardrails for the SEO agent's uncommitted changes. publish.sh refuses to push unless this passes.
//
// The agent may only:
//   - add or edit blog posts (blog/posts/<lang>/<slug>.md), every key present in all languages,
//   - add homepage FAQ items to blog/faq/<lang>.html (the build puts them on the home page and
//     into its FAQPage JSON-LD); the home pages themselves are generated and off limits,
//   - write its own files (seo-agent/data/**, seo-agent/log.md).
// Everything else on the site is hand-written and must stay byte-identical.
//
// Usage: node seo-agent/validate.mjs

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

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
const fail = (file, msg) => errors.push(`${file}: ${msg}`);

const changed = [...new Set([
  ...git("diff", "--name-only", "--relative", "HEAD").split("\n"),
  ...git("ls-files", "--others", "--exclude-standard").split("\n"),
].filter(Boolean))];

const FAQ = /^blog\/faq\/([a-z]{2})\.html$/;
const POST = /^blog\/posts\/([a-z]{2})\/([^/]+)\.md$/;
const allowed = (f) => POST.test(f) || (FAQ.test(f) && LANGS.includes(f.match(FAQ)[1]))
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
// Posts

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

const allPosts = [];
for (const code of LANGS) {
  const dir = path.join(ROOT, "blog", "posts", code);
  if (!fs.existsSync(dir)) continue;
  for (const name of fs.readdirSync(dir).filter((n) => n.endsWith(".md"))) {
    const file = `blog/posts/${code}/${name}`;
    allPosts.push({ file, lang: code, slug: name.slice(0, -3), post: parse(file) });
  }
}

const touchedKeys = new Set();
for (const f of changed.filter((f) => POST.test(f) && fs.existsSync(path.join(ROOT, f)))) {
  const [, lang, slug] = f.match(POST);
  if (!LANGS.includes(lang)) { fail(f, `unknown language "${lang}"`); continue; }
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length > 70) fail(f, "slug must be lowercase ASCII words joined by hyphens, ≤70 chars");
  const p = parse(f);
  if (!p) { fail(f, "missing --- front matter ---"); continue; }
  const { meta, body } = p;
  for (const k of ["title", "description", "date", "key", "keywords"]) if (!meta[k]) fail(f, `front matter needs "${k}"`);
  const len = (s) => [...(s || "")].length;
  if (len(meta.title) > 65 || len(meta.title) < 20) fail(f, `title is ${len(meta.title)} chars (20–65)`);
  if (len(meta.description) > 160 || len(meta.description) < 110) fail(f, `description is ${len(meta.description)} chars (110–160)`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(meta.date || "") || meta.date > today) fail(f, `bad or future date "${meta.date}"`);
  if (meta.updated && (!/^\d{4}-\d{2}-\d{2}$/.test(meta.updated) || meta.updated > today)) fail(f, `bad updated "${meta.updated}"`);
  if (/^#\s/m.test(body)) fail(f, "no H1 in the body — the title is the H1; start sections at ##");
  if ((body.match(/^\{\{app-cta\}\}$/gm) || []).length !== 1) fail(f, "{{app-cta}} must appear exactly once, on its own line");
  if (len(body) < 3000) fail(f, `body is only ${len(body)} chars (min 3000) — too thin to publish`);
  if (/<script|<iframe|<style|javascript:/i.test(body)) fail(f, "raw script/iframe/style is not allowed");
  for (const [, url] of body.matchAll(/\]\(([^)\s]+)/g)) {
    if (!/^(\/|https:\/\/|#)/.test(url)) fail(f, `link must be internal (/…), https or #anchor: ${url}`);
  }
  // Unicode-aware boundaries, and TODO/TBD case-sensitive: "método" and "sobre todo" are ordinary words.
  if (/(?<![\p{L}\p{N}_])(?:TODO|TBD)(?![\p{L}\p{N}_])/u.test(body) || /(?<![\p{L}\p{N}_])(?:lorem ipsum|as an ai)(?![\p{L}\p{N}_])/iu.test(body)) fail(f, "placeholder or AI boilerplate left in the text");
  if (meta.key) touchedKeys.add(meta.key);
}

for (const key of touchedKeys) {
  const group = allPosts.filter((p) => p.post?.meta.key === key);
  for (const code of LANGS) {
    const n = group.filter((p) => p.lang === code).length;
    if (n === 0) errors.push(`key "${key}": no ${code} version — every post needs all ${LANGS.length} languages`);
    if (n > 1) errors.push(`key "${key}": ${n} ${code} posts share it`);
  }
}

// One new article per day keeps a runaway run from flooding the site.
const newKeysToday = new Set(allPosts.filter((p) => changed.includes(p.file) && !headVersion(p.file)
  && p.post?.meta.date === today).map((p) => p.post.meta.key));
const existingKeys = new Set(allPosts.filter((p) => headVersion(p.file)).map((p) => p.post?.meta.key));
const reallyNew = [...newKeysToday].filter((k) => !existingKeys.has(k));
if (reallyNew.length > 1) errors.push(`${reallyNew.length} new articles in one run (${reallyNew.join(", ")}) — publish one per day`);

const slugs = allPosts.map((p) => `${p.lang}/${p.slug}`);
if (new Set(slugs).size !== slugs.length) errors.push("duplicate slug within a language");

if (errors.length) {
  console.error(`✗ ${errors.length} problem(s):\n- ${errors.join("\n- ")}`);
  process.exit(1);
}
console.log(`✓ valid — ${changed.length} changed file(s): ${changed.join(", ") || "none"}`);
