create table if not exists public.winturbo_events (
  id uuid primary key default gen_random_uuid(),
  external_event_id text not null unique,
  sport_id text,
  sport_name text not null,
  tournament_id text,
  tournament_name text,
  event_name text not null,
  home_name text,
  away_name text,
  starts_at timestamptz not null,
  market_count integer not null default 0,
  provider text,
  source_url text not null default 'https://winturbo.com/',
  is_active boolean not null default true,
  raw_data jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists winturbo_events_starts_at_idx on public.winturbo_events (starts_at);
create index if not exists winturbo_events_sport_starts_idx on public.winturbo_events (sport_name, starts_at);
alter table public.winturbo_events enable row level security;

drop policy if exists "Authenticated users can view WinTurbo events" on public.winturbo_events;
create policy "Authenticated users can view WinTurbo events"
on public.winturbo_events for select to authenticated using (true);

grant select on public.winturbo_events to authenticated;

alter table public.social_content_plans
  add column if not exists content_mix text not null default 'auto';

alter table public.social_content_calendar
  add column if not exists event_id uuid references public.winturbo_events(id) on delete set null;

create index if not exists social_content_calendar_event_idx
  on public.social_content_calendar (event_id);

create table if not exists public.event_collection_runs (
  id uuid primary key default gen_random_uuid(),
  status text not null check (status in ('running','completed','failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  events_received integer not null default 0,
  events_upserted integer not null default 0,
  error_message text
);

alter table public.event_collection_runs enable row level security;
drop policy if exists "Authenticated users can view event collection runs" on public.event_collection_runs;
create policy "Authenticated users can view event collection runs"
on public.event_collection_runs for select to authenticated using (true);
grant select on public.event_collection_runs to authenticated;

