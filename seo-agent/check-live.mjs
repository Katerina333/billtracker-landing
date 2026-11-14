// Live check after publish.sh (AGENT.md step 10): every URL the last commit touched must answer
// 200 on billtrackerx.com, tuned home pages must show their new <title>, and new pages must be in the
// live sitemap. Polls for up to ~10 minutes while Cloudflare deploys.
//
// Usage: node seo-agent/check-live.mjs [<commit>]   (default HEAD) — exits 1 if something isn't live.

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { homeURL, blogURL, pageURL } from "../tools/i18n.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE = JSON.parse(fs.readFileSync(path.join(ROOT, "seo-agent", "config.json"), "utf8")).site;
const commit = process.argv[2] || "HEAD";
const files = execFileSync("git", ["show", "--name-only", "--diff-filter=AM", "--format=", commit], { cwd: ROOT, encoding: "utf8" })
  .split("\n").filter(Boolean);
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#x27;");

const checks = new Map();   // url → { mustContain?, isNew }
for (const f of files) {
  let m;
  const isNew = () => { try { execFileSync("git", ["cat-file", "-e", `${commit}~1:${f}`], { cwd: ROOT, stdio: "ignore" }); return false; } catch { return true; } };
  if ((m = f.match(/^blog\/posts\/([a-z]{2})\/([^/]+)\.md$/))) checks.set(blogURL(m[1]) + `${m[2]}/`, { isNew: isNew() });
  else if ((m = f.match(/^blog\/pages\/([a-z]{2})\/([^/]+)\.md$/))) checks.set(pageURL(m[1], m[2]), { isNew: isNew() });
  else if ((m = f.match(/^blog\/home\/([a-z]{2})\.json$/))) {
    const title = JSON.parse(fs.readFileSync(path.join(ROOT, f), "utf8")).meta_title;
    checks.set(homeURL(m[1]), { mustContain: title ? `<title>${esc(title)}</title>` : null });
  } else if ((m = f.match(/^blog\/faq\/([a-z]{2})\.html$/)) && !checks.has(homeURL(m[1]))) checks.set(homeURL(m[1]), {});
}
if (!checks.size) { console.log(`nothing to check — ${commit} touched no published content`); process.exit(0); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const get = async (url) => {
  try {
    const res = await fetch(`${SITE}${url}${url.includes("?") ? "&" : "?"}cb=${Date.now()}`, { redirect: "manual", signal: AbortSignal.timeout(15000) });
    return { status: res.status, text: res.status === 200 ? await res.text() : "" };
  } catch (err) { return { status: String(err.cause?.code || err.name), text: "" }; }
};

const pending = new Map(checks);
const result = new Map();
const deadline = Date.now() + 10 * 60e3;
while (pending.size && Date.now() < deadline) {
  for (const [url, c] of pending) {
    const r = await get(url);
    const ok = r.status === 200 && (!c.mustContain || r.text.includes(c.mustContain));
    result.set(url, ok ? "✓ 200" : r.status === 200 ? "⚠ 200 but the old version (new <title> not live yet)" : `✗ ${r.status}`);
    if (ok) pending.delete(url);
  }
  if (pending.size) await sleep(30e3);
}
const sitemap = (await get("/sitemap.xml")).text;
const missing = [...checks].filter(([url, c]) => c.isNew && !sitemap.includes(`<loc>${SITE}${url}</loc>`)).map(([u]) => u);

for (const [url, r] of result) console.log(`${r}  ${SITE}${url}`);
if (missing.length) console.log(`⚠ not in the live sitemap yet: ${missing.join(", ")}`);
if (pending.size) { console.log(`✗ ${pending.size} of ${checks.size} URLs not live after 10 minutes — the deploy probably failed; say so in the report`); process.exit(1); }
console.log(`✓ all ${checks.size} URLs live${missing.length ? "" : " and in the sitemap"}`);
