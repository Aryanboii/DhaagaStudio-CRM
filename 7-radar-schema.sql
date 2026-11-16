-- Business Radar: ADDITIVE migration. Existing public.leads table ko touch nahi karta.
create table if not exists public.radar_businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text default '',
  cin text, reg_date date,
  website_url text default '', domain text,
  email text, phone text, phone_norm text,
  instagram_url text default '', linkedin_url text default '',
  city text default '', state text default '', country text default 'India', address text default '',
  source text not null, source_url text default '', source_published_at date,
  first_detected_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  verification_status text not null default 'unverified',
  verification_confidence int default 0,
  lead_score int default 0, score_band text default '',
  launch_stage text default '', marketing_opportunity text default '', potential_services text default '',
  qualification_notes text default '',
  name_city_key text,
  status text not null default 'New',
  crm_lead_id text
);
create unique index if not exists radar_uq_cin on public.radar_businesses (cin) where cin is not null;
create unique index if not exists radar_uq_domain on public.radar_businesses (domain) where domain is not null;
create unique index if not exists radar_uq_phone on public.radar_businesses (phone_norm) where phone_norm is not null;
create unique index if not exists radar_uq_email on public.radar_businesses (lower(email)) where email is not null;
create unique index if not exists radar_uq_namecity on public.radar_businesses (name_city_key) where name_city_key is not null;
create index if not exists radar_idx_score on public.radar_businesses (lead_score desc);

create table if not exists public.radar_evidence (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.radar_businesses(id) on delete cascade,
  source text not null, source_url text default '', published_at date,
  detected_at timestamptz not null default now(), payload jsonb,
  unique (business_id, source, source_url)
);
create table if not exists public.radar_runs (
  id uuid primary key default gen_random_uuid(),
  pipeline text not null, started_at timestamptz not null default now(), finished_at timestamptz,
  status text default 'running', fetched int default 0, inserted int default 0,
  duplicates int default 0, promoted int default 0, error text
);
create table if not exists public.radar_signals (
  id uuid primary key default gen_random_uuid(),
  title text, url text unique, domain text, published_at timestamptz, query text,
  detected_at timestamptz not null default now(), reviewed boolean default false
);

alter table public.radar_businesses enable row level security;
alter table public.radar_evidence enable row level security;
alter table public.radar_runs enable row level security;
alter table public.radar_signals enable row level security;
drop policy if exists radar_b_read on public.radar_businesses;
drop policy if exists radar_b_upd on public.radar_businesses;
drop policy if exists radar_e_read on public.radar_evidence;
drop policy if exists radar_r_read on public.radar_runs;
drop policy if exists radar_s_read on public.radar_signals;
create policy radar_b_read on public.radar_businesses for select to authenticated using (true);
create policy radar_b_upd  on public.radar_businesses for update to authenticated using (true) with check (true);
create policy radar_e_read on public.radar_evidence for select to authenticated using (true);
create policy radar_r_read on public.radar_runs for select to authenticated using (true);
create policy radar_s_read on public.radar_signals for select to authenticated using (true);

-- Dedupe + upsert (priority: CIN > domain > phone > email > naam+city). Sirf service_role chala sakta hai.
create or replace function public.radar_upsert_business(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_new boolean := false;
  v_cin text := nullif(upper(btrim(p->>'cin')),'');
  v_domain text := nullif(lower(btrim(p->>'domain')),'');
  v_phone text := nullif(right(regexp_replace(coalesce(p->>'phone',''),'\D','','g'),10),'');
  v_email text := nullif(lower(btrim(p->>'email')),'');
  v_key text := regexp_replace(lower(coalesce(p->>'name','')),'[^a-z0-9]','','g') || '|' || lower(coalesce(p->>'city',''));
begin
  if length(coalesce(v_phone,'')) < 10 then v_phone := null; end if;
  if v_cin is not null then select id into v_id from radar_businesses where cin = v_cin limit 1; end if;
  if v_id is null and v_domain is not null then select id into v_id from radar_businesses where domain = v_domain limit 1; end if;
  if v_id is null and v_phone is not null then select id into v_id from radar_businesses where phone_norm = v_phone limit 1; end if;
  if v_id is null and v_email is not null then select id into v_id from radar_businesses where lower(email) = v_email limit 1; end if;
  if v_id is null then select id into v_id from radar_businesses where name_city_key = v_key limit 1; end if;
  if v_id is null then
    insert into radar_businesses (name,category,cin,reg_date,website_url,domain,email,phone,phone_norm,instagram_url,linkedin_url,
      city,state,country,address,source,source_url,source_published_at,verification_status,verification_confidence,
      lead_score,score_band,launch_stage,marketing_opportunity,potential_services,qualification_notes,name_city_key)
    values (p->>'name', coalesce(p->>'category',''), v_cin, nullif(p->>'reg_date','')::date, coalesce(p->>'website_url',''), v_domain,
      v_email, nullif(p->>'phone',''), v_phone, coalesce(p->>'instagram_url',''), coalesce(p->>'linkedin_url',''),
      coalesce(p->>'city',''), coalesce(p->>'state',''), coalesce(nullif(p->>'country',''),'India'), coalesce(p->>'address',''),
      p->>'source', coalesce(p->>'source_url',''), nullif(p->>'source_published_at','')::date,
      coalesce(p->>'verification_status','unverified'), coalesce(nullif(p->>'verification_confidence','')::int,0),
      coalesce(nullif(p->>'lead_score','')::int,0), coalesce(p->>'score_band',''), coalesce(p->>'launch_stage',''),
      coalesce(p->>'marketing_opportunity',''), coalesce(p->>'potential_services',''), coalesce(p->>'qualification_notes',''), v_key)
    returning id into v_id;
    v_new := true;
  else
    update radar_businesses set last_seen_at = now(),
      website_url = coalesce(nullif(website_url,''), p->>'website_url'),
      email = coalesce(email, v_email), phone = coalesce(phone, nullif(p->>'phone','')), phone_norm = coalesce(phone_norm, v_phone),
      lead_score = greatest(lead_score, coalesce(nullif(p->>'lead_score','')::int,0))
    where id = v_id;
  end if;
  insert into radar_evidence (business_id, source, source_url, published_at, payload)
  values (v_id, p->>'source', coalesce(p->>'source_url',''), nullif(p->>'source_published_at','')::date, p->'payload')
  on conflict do nothing;
  return jsonb_build_object('id', v_id, 'new', v_new);
end $$;

-- CRM mein promote: existing leads table mein ek normal row (duplicate naam ho to nayi row nahi banti)
create or replace function public.radar_promote(p_id uuid) returns text
language plpgsql security definer set search_path = public as $$
declare b radar_businesses; lid text;
begin
  select * into b from radar_businesses where id = p_id;
  if not found then return null; end if;
  if b.crm_lead_id is not null then return b.crm_lead_id; end if;
  select id into lid from leads where regexp_replace(lower(name),'[^a-z0-9]','','g') = regexp_replace(lower(b.name),'[^a-z0-9]','','g') limit 1;
  if lid is null then
    lid := 'R' || replace(b.id::text,'-','');
    insert into leads (id, lead_no, name, city, addr, phone, email, link, who, ver, src, tag, status, notes, category, services)
    values (lid, '', b.name, b.city, b.address, coalesce(b.phone,''), coalesce(b.email,''),
      coalesce(nullif(b.website_url,''), 'https://www.google.com/maps/search/?api=1&query=' || replace(b.name || ' ' || b.city, ' ', '+')),
      '', b.verification_status || ' | CIN ' || coalesce(b.cin,'n/a') || ' | registered ' || coalesce(b.reg_date::text,'n/a'),
      'Business Radar - ' || b.source, 'Radar ' || b.lead_score || ' - ' || b.score_band, 'Not contacted',
      b.qualification_notes, coalesce(nullif(b.category,''),'New Businesses'), b.potential_services);
  end if;
  update radar_businesses set crm_lead_id = lid, status = 'In CRM' where id = p_id;
  return lid;
end $$;

create or replace function public.radar_promote_pending(min_score int) returns int
language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  for r in select id from radar_businesses where crm_lead_id is null and status = 'New' and lead_score >= min_score loop
    perform radar_promote(r.id); n := n + 1;
  end loop;
  return n;
end $$;

revoke all on function public.radar_upsert_business(jsonb) from public, anon, authenticated;
revoke all on function public.radar_promote_pending(int) from public, anon, authenticated;
revoke all on function public.radar_promote(uuid) from public, anon;
grant execute on function public.radar_promote(uuid) to authenticated;
