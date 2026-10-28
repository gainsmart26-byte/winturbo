-- Private backend-only storage. Access is checked against active admin profiles by the gateway.
create table if not exists public.trafficstars_connection (
 id integer primary key check (id=1), label text not null,
 currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
 ciphertext text not null, updated_by uuid references auth.users(id),
 updated_at timestamptz not null default now()
);
create table if not exists public.trafficstars_reports (
 report_key text primary key, payload jsonb not null,
 fetched_at timestamptz not null default now()
);
alter table public.trafficstars_connection enable row level security;
alter table public.trafficstars_reports enable row level security;
revoke all on public.trafficstars_connection, public.trafficstars_reports from public, anon, authenticated;
grant select,insert,update,delete on public.trafficstars_connection, public.trafficstars_reports to service_role;
