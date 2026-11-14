// Morning keyword pull for the SEO agent. Writes seo-agent/data/keywords-<date>.json and prints a
// compact brief the agent reads before choosing the day's topic.
//
// Sources:
//   1. Google Search Console via gum (https://gumcli.dev): the queries we already get impressions for,
//      by page (= site language) and by country. See AGENT.md → Search Console access.
//   2. Google + Bing autocomplete per language/market for the seeds in config.json — what people
//      type, even for queries we don't rank for yet. Bing is a second opinion and the fallback when
//      Google throttles (2026-11-14: every non-English language came back empty from Google).
//      `commercialSeeds` ("haushaltsbuch app") feed service pages and the home page.
//   3. What we already published (posts, service pages, home-page targets, agent FAQ entries), so
//      the agent doesn't repeat itself, plus refresh candidates from Search Console.
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
// gum keeps one sign-in per profile. This site has its own (Google Cloud project "billtrackerx");
// the default profile belongs to another site's agent and must not be used or changed here.
const GUM_PROFILE = config.gumProfile || "default";
const day = (offset) => new Date(Date.now() + offset * 864e5).toISOString().slice(0, 10);
const today = day(0);

// ---------------------------------------------------------------------------------------------
// 1. Search Console

function gum(op, args) {
  const out = execFileSync(GUM, ["read", op, "--profile", GUM_PROFILE, "--args", JSON.stringify(args),
    "--output", "json", "--max-items", "all", "--log-level", "error"],
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
    fix: `needs a human: ${GUM} auth login --profile ${GUM_PROFILE} --scope https://www.googleapis.com/auth/webmasters,https://www.googleapis.com/auth/webmasters.readonly  (see seo-agent/AGENT.md → Search Console access)` };
}

// ---------------------------------------------------------------------------------------------
// 2. Autocomplete

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function suggest(q, hl, gl) {
  const url = `https://suggestqueries.google.com/complete/search?client=firefox&hl=${hl}&gl=${gl}&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  // The endpoint answers in the market's legacy charset unless asked otherwise; utf-8 works for these langs.
  return JSON.parse(buf.toString("utf8"))[1] || [];
}
// Google throttles bursts: on 2026-11-14 every language after English came back empty and the run
// never knew why. So each request gets up to 3 tries with growing pauses, and what still fails is
// counted per language and printed in the brief instead of being swallowed.
async function suggestWithRetry(q, hl, gl) {
  let last;
  for (const wait of [0, 3000, 10000]) {
    if (wait) await sleep(wait);
    try { return await suggest(q, hl, gl); } catch (err) { last = err; }
  }
  throw last;
}

// Bing's osjson endpoint answers 204 (empty) after a few dozen requests; qsonhs keeps answering.
async function bing(q, market) {
  const url = `https://api.bing.com/qsonhs.aspx?type=cb&mkt=${market}&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  if (!text.trim()) throw new Error(`empty (HTTP ${res.status})`);
  return (JSON.parse(text).AS?.Results || []).flatMap((r) => r.Suggests || []).map((s) => s.Txt).filter(Boolean);
}

const suggestions = {};      // informational seeds → guides
const commercial = {};       // "… app" seeds → service pages and the home page
const suggestErrors = {};
const sources = {};
if (!process.argv.includes("--no-suggest")) {
  for (const [code, L] of Object.entries(config.langs)) {
    const errs = {};
    const count = (src, err) => {
      const why = `${src}: ${String(err.cause?.code || err.name === "TimeoutError" && "timeout" || err.message).slice(0, 50)}`;
      errs[why] = (errs[why] || 0) + 1;
    };
    const used = new Set();
    async function gather(seeds) {
      const seen = new Set();
      for (const seed of seeds) {
        for (const gl of L.gl.slice(0, 2)) {
          try { for (const s of await suggestWithRetry(seed, L.hl, gl)) seen.add(s); used.add("google"); } catch (err) { count("google", err); }
          await sleep(400);
        }
        if (L.market) {
          try { for (const s of await bing(seed, L.market)) seen.add(s.toLowerCase()); used.add("bing"); } catch (err) { count("bing", err); }
          await sleep(200);
        }
      }
      return [...seen];
    }
    suggestions[code] = await gather(L.seeds);
    commercial[code] = await gather([...(L.commercialSeeds || []),
      ...L.seeds.slice(0, 3).map((s) => `${s} ${L.appWord || "app"}`)]);
    sources[code] = [...used];
    if (Object.keys(errs).length) suggestErrors[code] = errs;
  }
}

// ---------------------------------------------------------------------------------------------
// 3. What we already have

const published = [];
for (const [kind, dirName] of [["post", "posts"], ["page", "pages"]]) {
  for (const code of Object.keys(config.langs)) {
    const dir = path.join(ROOT, "blog", dirName, code);
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir).filter((n) => n.endsWith(".md"))) {
      const raw = fs.readFileSync(path.join(dir, name), "utf8");
      const get = (k) => (raw.match(new RegExp(`^${k}: (.*)$`, "m")) || [])[1] || "";
      published.push({ kind, lang: code, slug: name.replace(/\.md$/, ""), key: get("key"), cluster: get("cluster"),
        date: get("date"), updated: get("updated"), title: get("title"), keywords: get("keywords") });
    }
  }
}
// What the home page targets now, per language (the agent's tuned strings win over i18n).
const home = {};
for (const code of Object.keys(config.langs)) {
  const strings = JSON.parse(fs.readFileSync(path.join(ROOT, "i18n", `${code}.json`), "utf8"));
  const file = path.join(ROOT, "blog", "home", `${code}.json`);
  const tuned = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
  const pick = (k) => tuned[k] ?? strings[k];
  home[code] = { meta_title: pick("meta_title"), meta_desc: pick("meta_desc"), hero_h1: pick("hero_h1"),
    targets: tuned._targets || [], updated: tuned._updated || null };
}
// Refresh candidates: pages older than 3 weeks that Google already shows on page 1–3 for queries.
const refresh = [];
if (gsc.ok) {
  const byUrl = new Map();
  for (const r of gsc.byPage) {
    const e = byUrl.get(r.page) || { page: new URL(r.page).pathname, impressions: 0, queries: [] };
    e.impressions += r.impressions; e.queries.push(r); byUrl.set(r.page, e);
  }
  for (const e of byUrl.values()) {
    const p = published.find((x) => e.page.endsWith(`/${x.slug}/`));
    const age = p ? (Date.parse(today) - Date.parse(p.updated || p.date)) / 864e5 : 999;
    const near = e.queries.filter((q) => q.position >= 5 && q.position <= 30).sort((a, b) => b.impressions - a.impressions);
    if (age > 21 && e.impressions >= 20 && near.length) refresh.push({ page: e.page, key: p?.key, age: Math.round(age),
      impressions: e.impressions, queries: near.slice(0, 8).map((q) => `${q.query} (pos ${q.position}, ${q.impressions} impr)`) });
  }
  refresh.sort((a, b) => b.impressions - a.impressions);
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

const data = { date: today, gsc, suggestions, commercial, sources, suggestErrors, published, home, refresh, homeFaq };
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
const emptyLangs = Object.entries(suggestions).filter(([, list]) => !list.length).map(([code]) => code);
if (emptyLangs.length) {
  lines.push(`## Autocomplete: NO DATA for ${emptyLangs.join(", ")}`,
    "Requests failed even after retries (see the errors below). Say so in the log line and the report.", "");
}
for (const [code, list] of Object.entries(suggestions)) {
  lines.push(`### ${code} — autocomplete (${list.length}, via ${(sources[code] || []).join("+") || "nothing"})`);
  if (suggestErrors[code]) {
    lines.push(`⚠ failed requests: ${Object.entries(suggestErrors[code]).map(([why, n]) => `${why} ×${n}`).join(", ")}`);
  }
  lines.push(list.slice(0, 40).join(" | "));
  lines.push(`commercial (${(commercial[code] || []).length}): ${(commercial[code] || []).slice(0, 30).join(" | ")}`, "");
}
if (refresh.length) {
  lines.push("## Refresh candidates (older than 3 weeks, ranking 5–30 for these queries)");
  for (const r of refresh.slice(0, 8)) lines.push(`- ${r.page} [${r.key}] ${r.impressions} impr, ${r.age} d old: ${r.queries.join("; ")}`);
  lines.push("");
}
lines.push("## Home page now (title · H1 · tuned targets · last tuned)");
for (const [code, h] of Object.entries(home)) lines.push(`- ${code}: ${h.meta_title} · ${h.hero_h1} · ${h.targets.join(", ") || "—"} · ${h.updated || "never"}`);
lines.push("", "## Service pages (en)");
for (const p of published.filter((p) => p.lang === "en" && p.kind === "page")) lines.push(`- ${p.date} ${p.key}: ${p.title} — ${p.keywords}`);
lines.push("## Guides (en) — key · cluster · main keywords");
for (const p of published.filter((p) => p.lang === "en" && p.kind === "post")) lines.push(`- ${p.date} ${p.key} · ${p.cluster || "—"}: ${p.title} — ${p.keywords.split(",").slice(0, 3).join(",")}`);
lines.push("## Homepage FAQ questions (en)", ...homeFaq.en.map((q) => `- ${q}`));
console.log(lines.join("\n"));
