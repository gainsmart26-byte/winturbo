-- Leads inherit the existing active-admin authorization boundary.
create table if not exists public.lead_intell_records (
  lead_key text primary key check (length(lead_key) between 3 and 130),
  username text check (username ~ '^[A-Za-z0-9_.@-]{1,100}$'),
  phone text check (phone ~ '^\+?[0-9 ()-]{7,30}$'),
  response text check (response in ('Disconnected','Message Sent','Connected Not Interested','Need Offer','Call Back')),
  callback_at timestamptz,
  notes text not null default '' check (length(notes)<=2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (nullif(btrim(username),'') is not null or nullif(btrim(phone),'') is not null),
  check ((response='Call Back' and callback_at is not null) or (response is distinct from 'Call Back' and callback_at is null))
);
alter table public.lead_intell_records enable row level security;
revoke all on public.lead_intell_records from anon,authenticated;
grant select,insert,update on public.lead_intell_records to authenticated;
do $policy$ begin
if not exists (select 1 from pg_policies where schemaname='public' and tablename='lead_intell_records' and policyname='leads_admin_read') then
create policy leads_admin_read on public.lead_intell_records for select to authenticated
using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_active and p.role='admin'));
end if; end $policy$;
do $policy$ begin
if not exists (select 1 from pg_policies where schemaname='public' and tablename='lead_intell_records' and policyname='leads_admin_insert') then
create policy leads_admin_insert on public.lead_intell_records for insert to authenticated
with check (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_active and p.role='admin'));
end if; end $policy$;
do $policy$ begin
if not exists (select 1 from pg_policies where schemaname='public' and tablename='lead_intell_records' and policyname='leads_admin_update') then
create policy leads_admin_update on public.lead_intell_records for update to authenticated
using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_active and p.role='admin'))
with check (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_active and p.role='admin'));
end if; end $policy$;
create index if not exists lead_intell_callback_idx on public.lead_intell_records(callback_at) where response='Call Back';
