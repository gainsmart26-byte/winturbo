alter table public.chatbot_sessions add column if not exists verified_user_id uuid;
create table if not exists public.chatbot_request_limits (
 bucket text primary key,
 window_start timestamptz not null default date_trunc('hour',now()),
 hits integer not null default 1
);
alter table public.chatbot_request_limits enable row level security;
revoke all on public.chatbot_request_limits from anon,authenticated;
grant all on public.chatbot_request_limits to service_role;
create or replace function public.turboman_take_quota(p_bucket text,p_limit integer)
returns boolean language sql security invoker set search_path=public as $$
 with used as (
 insert into public.chatbot_request_limits(bucket,window_start,hits)
 values(p_bucket,date_trunc('hour',now()),1)
 on conflict(bucket) do update set
 hits=case when chatbot_request_limits.window_start=date_trunc('hour',now()) then chatbot_request_limits.hits+1 else 1 end,
 window_start=date_trunc('hour',now())
 returning hits
 ) select hits<=p_limit from used;
$$;
revoke all on function public.turboman_take_quota(text,integer) from public,anon,authenticated;
grant execute on function public.turboman_take_quota(text,integer) to service_role;
create or replace function public.turboman_verified_player(p_phone text)
returns table(username text,status text,registered_at timestamptz,lifetime_deposits numeric,deposit_count integer,withdrawal_count integer,lifetime_withdrawals numeric,synced_at timestamptz)
language sql security invoker set search_path=public as $$
 select p.username,p.status,p.registered_at,p.lifetime_deposits,p.deposit_count,p.withdrawal_count,p.lifetime_withdrawals,p.synced_at
 from public.admin_players p
 where regexp_replace(p.phone,'[^0-9]','','g') in (p_phone,substring(p_phone from 3))
 and p_phone ~ '^91[6-9][0-9]{9}$'
 limit 2;
$$;
revoke all on function public.turboman_verified_player(text) from public,anon,authenticated;
grant execute on function public.turboman_verified_player(text) to service_role;
alter table public.chatbot_sessions add column if not exists support_version smallint not null default 1;