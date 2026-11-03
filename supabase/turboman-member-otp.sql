create table if not exists public.chatbot_member_challenges(
 id uuid primary key default gen_random_uuid(),username text,expires_at timestamptz not null default now()+interval '10 minutes',attempts integer not null default 0,consumed_at timestamptz
);
alter table public.chatbot_member_challenges enable row level security;
revoke all on public.chatbot_member_challenges from anon,authenticated;
grant all on public.chatbot_member_challenges to service_role;
create or replace function public.turboman_find_member(p_username text)
returns table(username text,phone text) language sql security invoker set search_path=public as $$
 select p.username,p.phone from public.admin_players p where lower(p.username)=lower(p_username) limit 2;
$$;
revoke all on function public.turboman_find_member(text) from public,anon,authenticated;
grant execute on function public.turboman_find_member(text) to service_role;
create or replace function public.turboman_otp_attempt(p_challenge uuid)
returns table(username text) language sql security invoker set search_path=public as $$
 update public.chatbot_member_challenges set attempts=attempts+1 where id=p_challenge and consumed_at is null and expires_at>now() and attempts<5 returning username;
$$;
revoke all on function public.turboman_otp_attempt(uuid) from public,anon,authenticated;
grant execute on function public.turboman_otp_attempt(uuid) to service_role;