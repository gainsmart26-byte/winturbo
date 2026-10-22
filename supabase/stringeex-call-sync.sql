create table if not exists public.stringeex_connection (
 id smallint primary key check(id=1), auth_token text not null,
 updated_by uuid references public.profiles(id), updated_at timestamptz not null default now(),
 last_synced_at timestamptz, sync_cursor jsonb, sync_from bigint, sync_to bigint,
 sync_locked_until timestamptz
);
create table if not exists public.stringeex_agent_links (
 stringeex_id text primary key, user_id uuid not null references public.leads_agents(user_id),
 updated_at timestamptz not null default now()
);
create table if not exists public.stringeex_calls (
 call_id text primary key, phone text not null, stringeex_agent_id text,
 agent_name text, started_at timestamptz not null, ended_at timestamptz,
 status text not null, duration_seconds integer not null default 0,
 talk_seconds integer not null default 0, end_reason text,
 synced_at timestamptz not null default now()
);
create index if not exists stringeex_calls_phone_time on public.stringeex_calls(phone, started_at desc);
alter table public.stringeex_connection enable row level security;
alter table public.stringeex_agent_links enable row level security;
alter table public.stringeex_calls enable row level security;
revoke all on public.stringeex_connection, public.stringeex_agent_links, public.stringeex_calls from anon, authenticated;
grant all on public.stringeex_connection, public.stringeex_agent_links, public.stringeex_calls to service_role;
