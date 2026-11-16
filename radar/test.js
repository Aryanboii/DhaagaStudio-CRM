import assert from "node:assert/strict";
import { normalizeMca, scoreMca, parseDate, cityFromAddress, categoryFor, dateNDaysAgo } from "./lib.js";
const today = new Date("2026-11-15T00:00:00Z");
assert.equal(parseDate("05-11-2026"), "2026-11-05"); assert.equal(parseDate("2026-11-05T00:00:00"), "2026-11-05"); assert.equal(parseDate("junk"), null);
assert.equal(cityFromAddress("Plot 4, Sector 62, Greater Noida, UP"), "Greater Noida"); assert.equal(cityFromAddress("Andheri, Mumbai"), "");
assert.equal(dateNDaysAgo(5, today), "2026-11-10");
const row = { COMPANY_NAME: "ABC FOODS PRIVATE LIMITED", CORPORATE_IDENTIFICATION_NUMBER: "u56101dl2026ptc123456", DATE_OF_REGISTRATION: "10-11-2026",
  REGISTERED_OFFICE_ADDRESS: "Shop 5, Sector 18, Noida, Uttar Pradesh", COMPANY_STATUS: "Active", PRINCIPAL_BUSINESS_ACTIVITY: "Restaurants", PAIDUP_CAPITAL: "100000" };
const b = normalizeMca(row);
assert.equal(b.city, "Noida"); assert.equal(b.cin, "U56101DL2026PTC123456"); assert.equal(b.reg_date, "2026-11-10");
const s = scoreMca(b, today);
assert.equal(s.category, "Restaurants"); assert.equal(s.lead_score, 80); assert.equal(s.score_band, "High priority"); assert.equal(s.verification_status, "registry_confirmed");
const old = scoreMca({ ...b, reg_date: "2020-01-01", capital: 0, status: "" }, today);
assert.ok(old.lead_score < 60 && old.verification_status === "unverified");
assert.equal(categoryFor("Skyline Realty Developers"), "Real Estate");
console.log("all tests passed");
