// Morning keyword pull for the SEO agent. Writes seo-agent/data/keywords-<date>.json and prints a
// compact brief the agent reads before choosing the day's topic.
//
// Sources:
//   1. Google Search Console via gum (https://gumcli.dev): the queries we already get impressions for,
//      by page (= site language) and by country. See AGENT.md → Search Console access.
//   2. Google autocomplete per language/market for the seeds in config.json — what people type, even
//      for queries we don't rank for yet. Useful while the site is too new for Search Console data.
//   3. What we already published (blog posts + agent FAQ entries), so the agent doesn't repeat itself.
//
// Usage: node seo-agent/pull-keywords.mjs [--no-suggest]

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const AGENT = path.join(ROOT, "seo-agent");
const config = JSON.parse(fs.readFileSync(path.join(AGENT, "config.json"), "utf8"));
const GUM = config.gum.replace(/^~/, os.homedir());
const day = (offset) => new Date(Date.now() + offset * 864e5).toISOString().slice(0, 10);
const today = day(0);

// ---------------------------------------------------------------------------------------------
// 1. Search Console

function gum(op, args) {
  const out = execFileSync(GUM, ["read", op, "--args", JSON.stringify(args), "--output", "json",
    "--max-items", "all", "--log-level", "error"],
  { encoding: "utf8", maxBuffer: 64 << 20, stdio: ["ignore", "pipe", "pipe"] });
  return JSON.parse(out);
}

/** gum wraps API responses in an envelope; find the first array of objects that has `key`. */
function findArray(node, key) {
  if (Array.isArray(node)) {
    if (node.length && typeof node[0] === "object" && node[0] && key in node[0]) return node;
    for (const n of node) { const r = findArray(n, key); if (r) return r; }
  } else if (node && typeof node === "object") {
    for (const v of Object.values(node)) { const r = findArray(v, key); if (r) return r; }
  }
  return null;
}

function langOfPage(url) {
  const p = new URL(url).pathname;
  const code = Object.keys(config.langs).find((c) => c !== "en" && (p === `/${c}/` || p.startsWith(`/${c}/`)));
  return code || "en";
}

let gsc = { ok: false };
try {
  const sites = findArray(gum("searchconsole.sites.list", {}), "siteUrl") || [];
  const host = new URL(config.site).host;
  // Only properties we can actually read: an unverified one lists fine but returns no data.
  const usable = sites.filter((s) => ["siteOwner", "siteFullUser", "siteRestrictedUser"].includes(s.permissionLevel));
  const site = usable.find((s) => s.siteUrl === `sc-domain:${host}`)
    || usable.find((s) => new URL(s.siteUrl.replace(/^sc-domain:/, "https://")).host.replace(/^www\./, "") === host);
  if (!site) throw new Error(`no Search Console property for ${host} in: ${sites.map((s) => s.siteUrl).join(", ")}`);
  // Search Console data lags ~2 days.
  const window = { siteUrl: site.siteUrl, startDate: day(-2 - config.gscWindowDays), endDate: day(-2) };
  const prev = { siteUrl: site.siteUrl, startDate: day(-2 - 2 * config.gscWindowDays), endDate: day(-3 - config.gscWindowDays) };
  // gum takes the path param at the top level and the request body under `body`.
  const q = ({ siteUrl, ...dates }, dimensions) => findArray(gum("searchconsole.searchanalytics.query",
    { siteUrl, body: { ...dates, dimensions, rowLimit: 5000 } }), "keys") || [];
  const row = (r, dims) => ({ ...Object.fromEntries(dims.map((d, i) => [d, r.keys[i]])),
    clicks: r.clicks, impressions: r.impressions, ctr: +(r.ctr * 100).toFixed(1), position: +r.position.toFixed(1) });

  const byPage = q(window, ["query", "page"]).map((r) => ({ ...row(r, ["query", "page"]), lang: langOfPage(r.keys[1]) }));
  const byCountry = q(window, ["query", "country"]).map((r) => row(r, ["query", "country"]));
  const pages = q(window, ["page"]).map((r) => row(r, ["page"]));
  const prevQueries = new Map(q(prev, ["query"]).map((r) => [r.keys[0], r.impressions]));
  gsc = { ok: true, property: site.siteUrl, window, byPage, byCountry, pages,
    totals: { clicks: byPage.reduce((s, r) => s + r.clicks, 0), impressions: byPage.reduce((s, r) => s + r.impressions, 0) },
    risingQueries: [...new Map(byPage.map((r) => [r.query, r])).values()]
      .map((r) => ({ query: r.query, lang: r.lang, impressions: r.impressions, before: prevQueries.get(r.query) || 0 }))
      .filter((r) => r.impressions >= 5 && r.impressions > 2 * r.before)
      .sort((a, b) => b.impressions - a.impressions).slice(0, 25) };
} catch (err) {
  let error = String(err.stdout || err.stderr || err.message || err).trim();
  try { const env = JSON.parse(error); error = `${env.error_code}: ${env.message}`; } catch { /* not an envelope */ }
  gsc = { ok: false, error: error.slice(0, 600),
    fix: `run: ${GUM} auth status --scopes webmasters.readonly  (see seo-agent/AGENT.md → Search Console access)` };
}

// ---------------------------------------------------------------------------------------------
// 2. Autocomplete

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function suggest(q, hl, gl) {
  const url = `https://suggestqueries.google.com/complete/search?client=firefox&hl=${hl}&gl=${gl}&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`autocomplete ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  // The endpoint answers in the market's legacy charset unless asked otherwise; utf-8 works for these langs.
  return JSON.parse(buf.toString("utf8"))[1] || [];
}

const suggestions = {};
if (!process.argv.includes("--no-suggest")) {
  for (const [code, L] of Object.entries(config.langs)) {
    const seen = new Set();
    for (const seed of L.seeds) {
      for (const gl of L.gl.slice(0, 2)) {
        try { for (const s of await suggest(seed, L.hl, gl)) seen.add(s); } catch { /* best effort */ }
        await sleep(250);
      }
    }
    suggestions[code] = [...seen];
  }
}

// ---------------------------------------------------------------------------------------------
// 3. What we already have

const published = [];
for (const code of Object.keys(config.langs)) {
  const dir = path.join(ROOT, "blog", "posts", code);
  if (!fs.existsSync(dir)) continue;
  for (const name of fs.readdirSync(dir).filter((n) => n.endsWith(".md"))) {
    const raw = fs.readFileSync(path.join(dir, name), "utf8");
    const get = (k) => (raw.match(new RegExp(`^${k}: (.*)$`, "m")) || [])[1] || "";
    published.push({ lang: code, slug: name.replace(/\.md$/, ""), key: get("key"), date: get("date"),
      title: get("title"), keywords: get("keywords") });
  }
}
// Home page FAQ: the five hand-written questions (i18n/<lang>.json) plus the agent's own (blog/faq/).
const homeFaq = {};
for (const code of Object.keys(config.langs)) {
  const strings = JSON.parse(fs.readFileSync(path.join(ROOT, "i18n", `${code}.json`), "utf8"));
  const file = path.join(ROOT, "blog", "faq", `${code}.html`);
  const html = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  homeFaq[code] = [...Object.keys(strings).filter((k) => /^q\d+$/.test(k)).map((k) => strings[k]),
    ...[...html.matchAll(/<summary>([\s\S]*?)<\/summary>/g)].map((m) => m[1].trim())];
}

// ---------------------------------------------------------------------------------------------
// Save + brief

const data = { date: today, gsc, suggestions, published, homeFaq };
fs.mkdirSync(path.join(AGENT, "data"), { recursive: true });
// Keep 90 days of snapshots.
for (const name of fs.readdirSync(path.join(AGENT, "data"))) {
  const d = name.match(/^keywords-(\d{4}-\d{2}-\d{2})\.json$/);
  if (d && d[1] < day(-90)) fs.rmSync(path.join(AGENT, "data", name));
}
const out = path.join(AGENT, "data", `keywords-${today}.json`);
fs.writeFileSync(out, JSON.stringify(data, null, 1));

const lines = [`# Keyword brief ${today}`, `full data: ${path.relative(ROOT, out)}`, ""];
if (gsc.ok) {
  lines.push(`## Search Console (${gsc.property}, ${gsc.window.startDate}…${gsc.window.endDate})`,
    `totals: ${gsc.totals.clicks} clicks, ${gsc.totals.impressions} impressions`, "");
  for (const code of Object.keys(config.langs)) {
    const rows = gsc.byPage.filter((r) => r.lang === code).sort((a, b) => b.impressions - a.impressions).slice(0, 15);
    if (!rows.length) continue;
    lines.push(`### ${code} — top queries (impr · clicks · pos · page)`);
    for (const r of rows) lines.push(`- ${r.query} · ${r.impressions} · ${r.clicks} · ${r.position} · ${new URL(r.page).pathname}`);
    lines.push("");
  }
  if (gsc.risingQueries.length) {
    lines.push("### Rising (impressions vs previous window)");
    for (const r of gsc.risingQueries) lines.push(`- [${r.lang}] ${r.query}: ${r.before} → ${r.impressions}`);
    lines.push("");
  }
} else {
  lines.push(`## Search Console: UNAVAILABLE`, gsc.error, gsc.fix, "");
}
for (const [code, list] of Object.entries(suggestions)) {
  lines.push(`### ${code} — autocomplete (${list.length})`, list.slice(0, 40).join(" | "), "");
}
lines.push("## Already published");
for (const p of published.filter((p) => p.lang === "en")) lines.push(`- ${p.date} ${p.key}: ${p.title}`);
lines.push("## Homepage FAQ questions (en)", ...homeFaq.en.map((q) => `- ${q}`));
console.log(lines.join("\n"));
