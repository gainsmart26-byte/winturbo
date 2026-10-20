create table public.wati_connections (
 id uuid primary key default gen_random_uuid(), label text not null check(length(label) between 1 and 100),
 business_number text not null, endpoint text not null, created_by uuid references auth.users(id),
 created_at timestamptz not null default now(), last_synced_at timestamptz, next_page integer not null default 1 check(next_page>0), last_error text,
 unique(endpoint,business_number)
);
create table public.wati_credentials (
 connection_id uuid primary key references public.wati_connections(id) on delete cascade, ciphertext text not null
);
create table public.wati_contacts (
 connection_id uuid references public.wati_connections(id) on delete cascade, phone text not null check(phone ~ '^[1-9][0-9]{6,14}$'),
 name text not null default '', contact_id text, contact_created_at timestamptz, first_seen_at timestamptz not null default now(), last_seen_at timestamptz not null default now(),
 primary key(connection_id,phone)
);
alter table public.wati_connections enable row level security;
alter table public.wati_credentials enable row level security;
alter table public.wati_contacts enable row level security;
revoke all on public.wati_connections,public.wati_credentials,public.wati_contacts from anon,authenticated;
grant all on public.wati_connections,public.wati_credentials,public.wati_contacts to service_role;
grant select on public.wati_connections,public.wati_contacts to authenticated;
create policy wati_admin_connections on public.wati_connections for select to authenticated using(exists(select 1 from public.profiles where id=(select auth.uid()) and is_active and role='admin'));
create policy wati_admin_contacts on public.wati_contacts for select to authenticated using(exists(select 1 from public.profiles where id=(select auth.uid()) and is_active and role='admin'));
create index wati_contacts_phone_idx on public.wati_contacts(phone);
-- Canonical matching matches Leads Intell: Indian 91 prefix reduces to ten digits.
create function public.wati_phone(value text) returns text language sql immutable strict set search_path='' as $$
 select case when d ~ '^91[0-9]{10}$' then substring(d from 3) else d end from (select regexp_replace(regexp_replace(value,'^00',''),'[^0-9]','','g') d) x;
$$;
revoke all on function public.wati_phone(text) from public,anon,authenticated;
grant execute on function public.wati_phone(text) to service_role;
create function public.ingest_wati_page(p_connection uuid,p_page integer,p_contacts jsonb,p_done boolean) returns jsonb language plpgsql security invoker set search_path='' as $$
declare expected integer; added integer;
begin
 select next_page into expected from public.wati_connections where id=p_connection for update;
 if expected is null or expected<>p_page then raise exception 'Sync page changed. Refresh before resuming.'; end if;
 if jsonb_typeof(p_contacts)<>'array' or jsonb_array_length(p_contacts)>100 then raise exception 'Invalid contacts page'; end if;
 insert into public.wati_contacts(connection_id,phone,name,contact_id,contact_created_at)
 select p_connection,x.phone,x.name,x.contact_id,x.contact_created_at from jsonb_to_recordset(p_contacts) x(phone text,name text,contact_id text,contact_created_at timestamptz)
 on conflict(connection_id,phone) do update set name=excluded.name,contact_id=excluded.contact_id,contact_created_at=coalesce(excluded.contact_created_at,public.wati_contacts.contact_created_at),last_seen_at=now();
 -- Link WATI source separately; preserve every existing lead's notes and response.
 perform pg_advisory_xact_lock(80721466);
 insert into public.lead_intell_records(lead_key,phone,lead_source,lead_date)
 select 'phone:'||x.phone,x.phone,'WATI',(now() at time zone 'Asia/Kolkata')::date
 from jsonb_to_recordset(p_contacts) x(phone text)
 where not exists(select 1 from public.admin_players p where public.wati_phone(p.phone)=x.phone)
 and not exists(select 1 from public.lead_intell_records r where public.wati_phone(r.phone)=x.phone)
 on conflict(lead_key) do nothing;
 get diagnostics added=row_count;
 update public.wati_connections set next_page=case when p_done then 1 else p_page+1 end,last_synced_at=case when p_done then now() else last_synced_at end,last_error=null where id=p_connection;
 return jsonb_build_object('new_leads',added);
end $$;
revoke all on function public.ingest_wati_page(uuid,integer,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.ingest_wati_page(uuid,integer,jsonb,boolean) to service_role;
