create table if not exists public.admin_agent_commissions (
 id uuid primary key default gen_random_uuid(),slot_no smallint not null unique check(slot_no between 1 and 50),
 agent_name text not null,agent_username text not null,profile_id uuid references public.profiles(id) on delete set null,
 commission_type text not null default 'percentage' check(commission_type in('percentage','fixed')),
 commission_value numeric(12,2) not null default 0 check(commission_value>=0),is_authorized boolean not null default false,
 authorized_by uuid references auth.users(id) on delete set null,authorized_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
alter table public.admin_agent_commissions enable row level security;
create table if not exists public.admin_player_notes (
 id uuid primary key default gen_random_uuid(),username text not null,note_type text not null default 'general' check(note_type in('general','follow_up','deposit','non_ftd','payment')),
 note_text text not null check(char_length(btrim(note_text)) between 1 and 2000),created_by uuid not null references auth.users(id) on delete restrict,created_at timestamptz not null default now());
create index if not exists admin_player_notes_username_created_idx on public.admin_player_notes(username,created_at desc);
alter table public.admin_player_notes enable row level security;
create policy admin_agent_commissions_read on public.admin_agent_commissions for select to authenticated using(profile_id=(select auth.uid()) or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_active and p.role='admin'));
create policy admin_agent_commissions_admin_insert on public.admin_agent_commissions for insert to authenticated with check(exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_active and p.role='admin'));
create policy admin_agent_commissions_admin_update on public.admin_agent_commissions for update to authenticated using(exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_active and p.role='admin')) with check(exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_active and p.role='admin'));
create policy admin_players_read_authorized_agents on public.admin_players for select to authenticated using(exists(select 1 from public.admin_agent_commissions c where c.profile_id=(select auth.uid()) and c.is_authorized and c.agent_username=admin_players.agent->>'username'));
create policy admin_deposit_events_read_authorized_agents on public.admin_deposit_events for select to authenticated using(exists(select 1 from public.admin_agent_commissions c join public.admin_players p on p.username=admin_deposit_events.username where c.profile_id=(select auth.uid()) and c.is_authorized and c.agent_username=p.agent->>'username'));
create policy admin_player_notes_read on public.admin_player_notes for select to authenticated using(exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_active and p.role='admin') or exists(select 1 from public.admin_agent_commissions c join public.admin_players p on p.username=admin_player_notes.username where c.profile_id=(select auth.uid()) and c.is_authorized and c.agent_username=p.agent->>'username'));
create policy admin_player_notes_insert on public.admin_player_notes for insert to authenticated with check(created_by=(select auth.uid()) and(exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_active and p.role='admin') or exists(select 1 from public.admin_agent_commissions c join public.admin_players p on p.username=admin_player_notes.username where c.profile_id=(select auth.uid()) and c.is_authorized and c.agent_username=p.agent->>'username')));
grant select,insert on public.admin_player_notes to authenticated;
grant select,insert,update on public.admin_agent_commissions to authenticated;
