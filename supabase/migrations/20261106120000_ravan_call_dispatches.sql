create table public.ravan_call_dispatches (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  lead_key text not null,
  requested_by uuid not null,
  call_day date not null default ((now() at time zone 'Asia/Kolkata')::date),
  created_at timestamptz not null default now(),
  status text not null default 'dispatching',
  unique (phone, call_day)
);
alter table public.ravan_call_dispatches enable row level security;
revoke all on public.ravan_call_dispatches from anon, authenticated;
grant select, insert, update on public.ravan_call_dispatches to service_role;
