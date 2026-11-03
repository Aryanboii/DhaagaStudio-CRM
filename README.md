# DhaagaStudio CRM – Vercel + Supabase setup

Files: `index.html` (CRM), `config.js` (Supabase keys), `1-schema.sql` (table + security), `2-seed.sql` (77 leads docx se).

## 1. Supabase project banao
1. https://supabase.com par free account → **New project** (region: Mumbai ya Singapore).
2. Left menu **SQL Editor** → New query → `1-schema.sql` ka poora text paste karo → **Run**.
3. Phir new query → `2-seed.sql` paste → **Run**. (Table Editor → `leads` mein 77 rows dikhni chahiye.)

## 2. Login user banao (sirf aap / aapki team)
1. **Authentication → Users → Add user → Create new user**: email + password daalo, "Auto Confirm User" ON rakho.
2. **Authentication → Sign In / Providers → Email**: **"Allow new users to sign up" OFF** kar do, taaki bahar ka koi account na bana sake.
3. Team ke liye har member ke liye isi tarah user add karo.

## 3. Keys config.js mein daalo
**Project Settings → API**: `Project URL` aur `Publishable key` (sb_publishable_...) ya purana `anon public` key copy karo → `config.js` mein paste karo.
(anon key public hoti hai, data ki suraksha RLS policy + login se hoti hai. **service_role key kabhi mat daalna.**)

## 4. Vercel par deploy
- Sabse aasan: Is folder ko GitHub repo mein push karo → vercel.com → **Add New → Project** → repo chuno → Framework Preset **Other**, Build command khaali → **Deploy**.
- Ya Vercel CLI: folder mein `npx vercel --prod`.

## 5. Test
Live link kholo → login karo → naya lead add karo → page refresh/doosre device par dekho, lead save rehna chahiye.

## Dhyan rakhne wali baatein
- Supabase free plan mein project kuch hafte inactive rehne par pause ho sakta hai; dashboard se "Restore/Resume" kar do, data safe rehta hai.
- Time-time par **Export CSV** se backup lo.
- Claude wale purane version ka data alag hai; us se CSV export karke Supabase Table Editor → Import CSV se laa sakte ho.

## Leads sync + galat rows safai (website ke andar)
Naya `index.html` deploy karke login karo, Leads tab ke upar ye boxes aa sakte hain:
- **🧹 N galat rows mili** (laal border): purane Import Docx se jo phone/link/sentence naam wali kachchi rows bani thi. **Inhe hata do** dabao. Sirf wahi rows hatati hai jinki source "Imported: ..." hai.
- **📥 Leads sync baaki hai**: **Sync karo** dabao. Nayi leads add hoti hain, maujooda leads mein Instagram/Facebook links judte hain, aur jo clinic pehle se hai (same naam/phone) wo dobara add nahi hoti. Status aur notes kabhi overwrite nahi hote.
- Agar `ig/fb/soc` column ka error aaye, box mein dikhaye 3 SQL lines Supabase SQL Editor mein ek baar run karo.

## Multi-industry update (Real Estate, Restaurants, BPO, MSME, New Business/Firms/Brands)
1. Supabase SQL Editor mein `6-multi-industry.sql` run karo (purane saare leads "Doctors / Clinics" ban jayenge).
2. `index.html` GitHub par replace karo. Vercel khud deploy karega.
3. Naye industry ke leads: "+ Add Lead" se ya "Import CSV" se (pehle "CSV Template" download karo).
