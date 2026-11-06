create table public.ravan_player_status_history (
  id bigint generated always as identity primary key,
  username text not null,
  status text not null,
  observed_at timestamptz not null default statement_timestamp()
);
create index on public.ravan_player_status_history (username, observed_at desc, id desc);
alter table public.ravan_player_status_history enable row level security;
revoke all on public.ravan_player_status_history from anon, authenticated;
grant select on public.ravan_player_status_history to authenticated;
create policy ravan_status_admin_read on public.ravan_player_status_history
for select to authenticated using (
  exists (select 1 from public.profiles where id = (select auth.uid()) and is_active and role = 'admin')
);

create function public.ravan_player_status(first_deposit boolean, first_at timestamptz, deposits bigint)
returns text language sql immutable set search_path = '' as $$
  select case
    when deposits > 1 then 'FTD · Repeat depositor'
    when deposits = 1 then 'FTD · No additional deposit'
    when first_deposit or first_at is not null then 'FTD · Deposit count unavailable'
    else 'Registered · Non-FTD'
  end
$$;

create function public.ravan_track_player_status()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  next_status text := public.ravan_player_status(new.ftd, new.ftd_at, new.deposit_count);
begin
  if tg_op = 'INSERT' or next_status is distinct from
    public.ravan_player_status(old.ftd, old.ftd_at, old.deposit_count) then
    insert into public.ravan_player_status_history (username, status)
    values (new.username, next_status);
  end if;
  return new;
end
$$;

create trigger ravan_track_player_status
after insert or update of ftd, ftd_at, deposit_count on public.admin_players
for each row execute function public.ravan_track_player_status();

insert into public.ravan_player_status_history (username, status)
select username, public.ravan_player_status(ftd, ftd_at, deposit_count)
from public.admin_players;

create view public.ravan_latest_player_status with (security_invoker = true) as
select distinct on (username) username, status, observed_at
from public.ravan_player_status_history
order by username, observed_at desc, id desc;
revoke all on public.ravan_latest_player_status from anon, authenticated;
grant select on public.ravan_latest_player_status to authenticated;
