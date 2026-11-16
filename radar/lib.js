// Pure helper functions (no network) - offline testable.
export const PRIORITY_CITIES = ["Delhi", "Noida", "Greater Noida", "Ghaziabad", "Gurugram", "Faridabad"];

const lower = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k.toLowerCase(), v]));
const pick = (r, ...keys) => { for (const k of keys) { const v = r[k]; if (v != null && String(v).trim() !== "") return String(v).trim(); } return ""; };

export function parseDate(s) {
  s = String(s || "").trim(); let m;
  if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})/))) return `${m[1]}-${m[2]}-${m[3]}`;
  if ((m = s.match(/^(\d{2})[-\/](\d{2})[-\/](\d{4})/))) return `${m[3]}-${m[2]}-${m[1]}`;
  return null;
}

export function cityFromAddress(addr) {
  const a = String(addr || "").toLowerCase();
  const map = [["greater noida", "Greater Noida"], ["noida", "Noida"], ["ghaziabad", "Ghaziabad"], ["gurugram", "Gurugram"],
    ["gurgaon", "Gurugram"], ["faridabad", "Faridabad"], ["new delhi", "Delhi"], ["delhi", "Delhi"]];
  for (const [k, v] of map) if (a.includes(k)) return v;
  return "";
}

export function categoryFor(text) {
  const t = String(text || "").toLowerCase();
  if (/restaurant|cafe|food|catering|hotel|bakery|kitchen|beverage/.test(t)) return "Restaurants";
  if (/real estate|realty|propert|builder|developer|housing|construction|infra/.test(t)) return "Real Estate";
  if (/health|medical|clinic|hospital|pharma|dental|diagnostic|wellness/.test(t)) return "Doctors / Clinics";
  if (/software|technolog|\bit\b|digital|consult|solutions|systems|tech|data|media|marketing|advert/.test(t)) return "New Firms";
  if (/trad|retail|manufactur|export|import|garment|textile|education|coaching|logistic|transport|engineering|industr/.test(t)) return "MSME Businesses";
  return "New Businesses";
}

const SERVICES = {
  "Restaurants": ["WhatsApp Automation", "Meta Ads", "Websites"],
  "Real Estate": ["Meta Ads", "AI Calling", "WhatsApp Automation"],
  "Doctors / Clinics": ["WhatsApp Automation", "AI Calling", "Meta Ads"],
  "New Firms": ["Websites", "Marketing Management", "Meta Ads"],
  "MSME Businesses": ["WhatsApp Automation", "Websites", "Marketing Management"],
  "New Businesses": ["Websites", "Marketing Management", "Meta Ads"],
};

// data.gov.in record -> normalized business (field names are matched defensively; run `probe` to confirm)
export function normalizeMca(raw) {
  const r = lower(raw);
  const name = pick(r, "company_name", "companyname", "name");
  const address = pick(r, "registered_office_address", "registeredofficeaddress", "address");
  return {
    name, address, city: cityFromAddress(address),
    cin: pick(r, "cin", "corporate_identification_number", "corporate_identification_no").toUpperCase(),
    reg_date: parseDate(pick(r, "date_of_registration", "dateofregistration", "registration_date", "date_of_incorporation")),
    state: pick(r, "registered_state", "state", "companystate"),
    status: pick(r, "company_status", "status", "companystatus"),
    activity: pick(r, "principal_business_activity", "principalbusinessactivity", "industrial_classification", "nic_description"),
    klass: pick(r, "company_class", "class"),
    capital: Number(pick(r, "paidup_capital", "paid_up_capital", "paidupcapital")) || 0,
  };
}

export function band(s) { return s >= 80 ? "High priority" : s >= 60 ? "Good opportunity" : s >= 40 ? "Research required" : "Low priority"; }

// Rule-based score (free, no LLM). Missing contact info is NOT treated as negative evidence.
export function scoreMca(b, today = new Date()) {
  let s = 20; const why = ["MCA official register mein company record mila"];
  const days = b.reg_date ? (today - new Date(b.reg_date)) / 864e5 : null;
  if (days != null && days >= 0 && days <= 30) { s += 30; why.push("pichle 30 din mein registered"); }
  else if (days != null && days >= 0 && days <= 90) { s += 20; why.push("pichle 90 din mein registered"); }
  else if (days != null && days >= 0 && days <= 180) { s += 10; why.push("pichle 6 mahine mein registered"); }
  if (PRIORITY_CITIES.includes(b.city)) { s += 10; why.push("priority city: " + b.city); }
  const category = categoryFor(b.activity + " " + b.name);
  if (["Restaurants", "Real Estate", "Doctors / Clinics"].includes(category)) { s += 15; why.push("consumer-facing industry (" + category + ")"); }
  else if (["New Firms", "MSME Businesses"].includes(category)) { s += 8; why.push("category: " + category); }
  else s += 5;
  if (b.capital >= 100000) { s += 5; why.push("paid-up capital >= Rs 1 lakh"); }
  s = Math.max(0, Math.min(100, s));
  const active = /active/i.test(b.status || "");
  return {
    category, lead_score: s, score_band: band(s),
    launch_stage: days == null ? "unknown" : days <= 30 ? "just registered" : days <= 180 ? "early stage" : "established",
    verification_status: active ? "registry_confirmed" : "unverified",
    verification_confidence: active ? 70 : 30,
    marketing_opportunity: "Naya registered business: website, enquiry automation aur ads ki zaroorat ho sakti hai (confirm karna baaki)",
    potential_services: SERVICES[category].join(", "),
    qualification_notes: why.join("; ") + ". Contact details abhi verify nahi hue (missing info = negative nahi).",
  };
}

export function dateNDaysAgo(n, today = new Date()) {
  const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - n));
  return d.toISOString().slice(0, 10);
}
