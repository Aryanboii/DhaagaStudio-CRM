# Dhaaga Business Radar (free kit) - CRM repo mein integrate

Zero-cost stack: data.gov.in (free API key) + GDELT (free) + GitHub Actions (free) + aapka Supabase. CRM ka frontend (index.html) nahi badalta.
n8n nahi lagaya, kyunki n8n ko 24x7 server chahiye; ye kit wahi tables/flow use karta hai, baad mein n8n add ho sakta hai.

## Setup (30 min)
1. **data.gov.in** par account banao -> Profile -> API key copy karo.
2. **Supabase SQL Editor** mein `7-radar-schema.sql` run karo (sirf naye `radar_*` tables + functions banti hain; `leads` ko chhua nahi jata).
3. Supabase -> Settings -> API se **Project URL** aur **service_role** key lo (service_role SECRET hai: kabhi frontend/CRM repo mein mat daalo).
4. Is kit ki files apne **DhaagaStudio-CRM repo ke root** mein daalo: `radar/` folder, `.github/workflows/radar.yml`, `7-radar-schema.sql`, `RADAR-README.md` (CRM ka apna README.md replace nahi hota).
   Repo public ho to Actions free hai; private ho to free minutes limited hain (ye job chhota hai). Code mein koi key ya data nahi hai.
5. Repo -> Settings -> Secrets and variables -> Actions -> **Secrets**: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `DATA_GOV_API_KEY`.
6. Actions tab -> "Business Radar" -> Run workflow -> mode **probe**. Log mein asli field names aur "registered on <date>: total=N" dikhega.
   - Totals sahi aaye -> aage badho. Totals 0 hon -> Variables mein `MCA_DATE_FIELD` ko log ke `fields` ke hisaab se set karo.
   - Agar recent dates par hamesha 0 aaye, to is free dataset mein abhi naye records nahi aa rahe (update lag) - tab paid daily feed hi early option hai.
7. Run workflow -> mode **mca**, days_back **30** (backfill). Phir mode **all** roz chalega.
8. Check: Supabase Table Editor -> `radar_businesses`, `radar_runs`; CRM ke Leads tab mein `src = Business Radar - MCA (data.gov.in)`.

## Kya milta hai / kya nahi
- MCA data: naam, CIN, registration date, registered address, status. **Phone/email nahi.** CRM lead mein Google Maps search link jaata hai; contact aap verify karo.
- Sirf Delhi, Noida, Greater Noida, Ghaziabad, Gurugram, Faridabad ke addresses rakhe jaate hain (`lib.js` -> PRIORITY_CITIES).
- Score 60+ wale leads automatically CRM mein aate hain (`PROMOTE_MIN_SCORE`). Koi message auto-send nahi hota.
- News (GDELT) sirf `radar_signals` mein headlines+links daalta hai (review ke liye); lead nahi banata.
- GitHub schedule best-effort hai (late/skip ho sakta hai; public repo 60 din inactive rahe to disable). Backup: cron-job.org se `workflow_dispatch` trigger karo.
- data.gov.in ke usage terms aur GDELT attribution ("GDELT Project") ka dhyan rakho.
