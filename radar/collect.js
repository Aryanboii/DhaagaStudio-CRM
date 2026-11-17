// Business Radar collector. Usage: node radar/collect.js probe|mca|news|all
import { normalizeMca, scoreMca, dateNDaysAgo, PRIORITY_CITIES } from "./lib.js";

const env = (k, d = "") => process.env[k] || d;
const SB_URL = env("SUPABASE_URL").replace(/\/$/, ""), SB_KEY = env("SUPABASE_SERVICE_KEY");
const OGD_KEY = env("DATA_GOV_API_KEY"), RESOURCE = env("MCA_RESOURCE_ID", "4dbe5667-7b6b-41d7-82af-211562424d9a");
const DATE_FIELD = env("MCA_DATE_FIELD", "CompanyRegistrationdate_date");
const DAYS_BACK = Number(env("MCA_DAYS_BACK", "3")), MIN_SCORE = Number(env("PROMOTE_MIN_SCORE", "60"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const why = (e) => String(e && e.message) + (e && e.cause ? " [" + (e.cause.code || "") + " " + (e.cause.message || e.cause) + "]" : "");
async function getJson(url, tries = 4) {
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "DhaagaRadar/1.0" }, signal: AbortSignal.timeout(20000) });
      if (res.status === 429 || res.status >= 500) throw new Error("HTTP " + res.status);
      if (!res.ok) throw new Error("HTTP " + res.status + " " + (await res.text()).slice(0, 200) + (res.status === 401 || res.status === 403 ? " -> HINT: DATA_GOV_API_KEY check karo" : res.status === 404 ? " -> HINT: resource ID galat ya is resource ka API enable nahi (data.gov.in par 'Request API')" : ""));
      return JSON.parse(await res.text());
    } catch (e) { if (i === tries) throw new Error(why(e) + " | host: " + new URL(String(url)).host); await sleep(2000 * i * i); }
  }
}
async function sb(path, method, body, prefer) {
  // Naye sb_secret_... keys JWT nahi hain: unhe sirf apikey header mein bhejna hota hai (Authorization mein nahi).
  const headers = { apikey: SB_KEY, "Content-Type": "application/json", ...(prefer ? { Prefer: prefer } : {}) };
  if (!SB_KEY.startsWith("sb_")) headers.Authorization = "Bearer " + SB_KEY;
  const res = await fetch(SB_URL + "/rest/v1/" + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const t = await res.text();
  if (!res.ok) {
    let hint = "";
    if (res.status === 404 || /PGRST20|does not exist|schema cache/.test(t)) hint = " -> HINT: Supabase SQL Editor mein 7-radar-schema.sql run karo.";
    if (res.status === 401 || res.status === 403) hint = " -> HINT: SUPABASE_SERVICE_KEY galat hai (service_role / sb_secret_ key chahiye, publishable nahi).";
    throw new Error("Supabase " + res.status + ": " + t.slice(0, 300) + hint);
  }
  return t ? JSON.parse(t) : null;
}
const rpc = (fn, args) => sb("rpc/" + fn, "POST", args);
const runStart = async (pipeline) => (await sb("radar_runs", "POST", { pipeline }, "return=representation"))[0].id;
const runEnd = (id, patch) => sb("radar_runs?id=eq." + id, "PATCH", patch);

function ogdUrl(date, offset) {
  const u = new URL("https://api.data.gov.in/resource/" + RESOURCE);
  u.searchParams.set("api-key", OGD_KEY); u.searchParams.set("format", "json");
  u.searchParams.set("limit", "500"); u.searchParams.set("offset", String(offset));
  if (date) u.searchParams.set(`filters[${DATE_FIELD}]`, date);
  return u;
}

// Connectivity check: kaunsa server GitHub se reachable hai?
async function ping() {
  const targets = [["supabase", SB_URL + "/rest/v1/", { apikey: SB_KEY }], ["data.gov.in API", "https://api.data.gov.in/", {}],
    ["data.gov.in website", "https://www.data.gov.in/", {}], ["gdelt", "https://api.gdeltproject.org/api/v2/doc/doc?query=test&mode=artlist&format=json&maxrecords=1", {}]];
  for (const [name, url, headers] of targets) {
    const t0 = Date.now();
    try { const r = await fetch(url, { headers: { "User-Agent": "DhaagaRadar/1.0", ...headers }, signal: AbortSignal.timeout(15000) });
      console.log(name.padEnd(22), "HTTP", r.status, (Date.now() - t0) + "ms"); }
    catch (e) { console.log(name.padEnd(22), "FAILED", why(e), (Date.now() - t0) + "ms"); }
  }
}

<<<<<<< HEAD
// Dataset kitna taaza hai? Peeche ki taraf dates scan karke sabse nayi registration date dhundta hai.
async function fresh() {
  if (!OGD_KEY) throw new Error("DATA_GOV_API_KEY set karo");
  let latest = null, after = 0;
  for (let n = 0; n <= 450 && after < 6; n += 3) {
    const d = dateNDaysAgo(n); const r = await getJson(ogdUrl(d, 0).toString().replace("limit=500", "limit=1")); const tot = Number(r.total || 0);
    console.log(d, "total=" + tot + (tot > 100000 ? "  <-- filter kaam nahi kar raha (poora dataset aa raha hai)" : ""));
    if (tot > 100000) return;
    if (tot > 0) { if (!latest) latest = d; after++; }
    await sleep(400);
  }
  console.log(latest ? "SABSE NAYI registration date jo dataset mein mili: " + latest + " (" + Math.round((Date.now() - new Date(latest)) / 864e5) + " din purani)" : "Pichle 450 din mein koi record nahi mila -> field name/format check karo");
}

=======
>>>>>>> 6f1e4204d844e5e9b40b4f771e563d168d469a1f
async function probe() {
  if (!OGD_KEY) throw new Error("DATA_GOV_API_KEY set karo");
  const j = await getJson(ogdUrl("", 0).toString().replace("limit=500", "limit=5"));
  console.log("total:", j.total, "| count:", j.count);
  console.log("fields:", (j.field || []).map((f) => f.id || f.name).join(", ") || Object.keys((j.records || [{}])[0]).join(", "));
  console.log("sample:", JSON.stringify((j.records || []).slice(0, 2), null, 1));
  for (const n of [1, 7, 30, 90]) {
    const d = dateNDaysAgo(n); const r = await getJson(ogdUrl(d, 0).toString().replace("limit=500", "limit=1"));
    console.log(`registered on ${d}: total=${r.total ?? "?"}`); await sleep(1000);
  }
  console.log("Agar saare totals 0/? hain to MCA_DATE_FIELD ya date format change karo (upar 'fields' dekho).");
}

async function mca() {
  if (!OGD_KEY || !SB_URL || !SB_KEY) throw new Error("DATA_GOV_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY zaroori hain");
  const run = await runStart("mca"); let fetched = 0, kept = 0, inserted = 0, dup = 0;
  try {
    for (let n = 0; n <= DAYS_BACK; n++) {
      const date = dateNDaysAgo(n);
      for (let offset = 0; ; offset += 500) {
        const j = await getJson(ogdUrl(date, offset)); const recs = j.records || []; fetched += recs.length;
        for (const raw of recs) {
          const b = normalizeMca(raw);
          if (!b.name || !PRIORITY_CITIES.includes(b.city)) continue;
          kept++; const sc = scoreMca(b);
          const out = await rpc("radar_upsert_business", { name: b.name, cin: b.cin, reg_date: b.reg_date, address: b.address, city: b.city,
            state: b.state, country: "India", source: "MCA (data.gov.in)", source_url: "https://data.gov.in/resource/" + RESOURCE,
            source_published_at: b.reg_date, category: sc.category, lead_score: sc.lead_score, score_band: sc.score_band,
            launch_stage: sc.launch_stage, verification_status: sc.verification_status, verification_confidence: sc.verification_confidence,
            marketing_opportunity: sc.marketing_opportunity, potential_services: sc.potential_services,
            qualification_notes: sc.qualification_notes, payload: raw });
          out.new ? inserted++ : dup++;
        }
        if (recs.length < 500) break; await sleep(1000);
      }
      await sleep(1000);
    }
    const promoted = await rpc("radar_promote_pending", { min_score: MIN_SCORE });
    await runEnd(run, { status: "ok", finished_at: new Date().toISOString(), fetched, inserted, duplicates: dup, promoted });
    console.log({ fetched, kept, inserted, duplicates: dup, promoted });
  } catch (e) { await runEnd(run, { status: "error", finished_at: new Date().toISOString(), error: String(e.message).slice(0, 500) }); throw e; }
}

// News signals via GDELT DOC API (free; attribution: GDELT Project). Titles/links only - review karke hi lead banao.
async function news() {
  if (!SB_URL || !SB_KEY) throw new Error("SUPABASE_URL, SUPABASE_SERVICE_KEY zaroori hain");
  const run = await runStart("news");
  const q = '(opens OR "grand opening" OR inaugurated OR launches) (restaurant OR cafe OR clinic OR hospital OR showroom OR gym OR salon) (Noida OR Gurugram OR Ghaziabad OR Faridabad OR "New Delhi") sourcecountry:IN';
  try {
    const u = "https://api.gdeltproject.org/api/v2/doc/doc?mode=artlist&format=json&maxrecords=75&timespan=1d&sort=datedesc&query=" + encodeURIComponent(q);
    const j = await getJson(u); const arts = j.articles || [];
    const rows = arts.map((a) => ({ title: a.title, url: a.url, domain: a.domain, query: "openings-ncr",
      published_at: a.seendate ? a.seendate.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/, "$1-$2-$3T$4:$5:$6Z") : null }));
    if (rows.length) await sb("radar_signals?on_conflict=url", "POST", rows, "resolution=ignore-duplicates");
    await runEnd(run, { status: "ok", finished_at: new Date().toISOString(), fetched: arts.length, inserted: rows.length });
    console.log("news signals:", rows.length);
  } catch (e) { await runEnd(run, { status: "error", finished_at: new Date().toISOString(), error: String(e.message).slice(0, 500) }); throw e; }
}

const mode = process.argv[2] || "all";
try {
  if (mode === "ping") await ping();
<<<<<<< HEAD
  else if (mode === "fresh") await fresh();
=======
>>>>>>> 6f1e4204d844e5e9b40b4f771e563d168d469a1f
  else if (mode === "probe") await probe();
  else if (mode === "mca") await mca();
  else if (mode === "news") await news();
  else { await mca(); await news(); }
} catch (e) { console.error("FAILED:", e.message); process.exit(1); }
