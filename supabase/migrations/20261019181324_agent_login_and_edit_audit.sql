create table public.leads_login_history (
 session_id uuid primary key, actor_id uuid not null references auth.users(id) on delete cascade,
 logged_in_at timestamptz not null, recorded_at timestamptz not null default now()
);
alter table public.leads_login_history enable row level security;
revoke all on public.leads_login_history from public,anon,authenticated;
grant select on public.leads_login_history to authenticated;
create policy leads_login_admin_read on public.leads_login_history for select to authenticated using(exists(select 1 from public.profiles where id=(select auth.uid()) and is_active and role='admin'));
create index leads_login_actor_time on public.leads_login_history(actor_id,logged_in_at desc);
create or replace function public.record_agent_login(p_actor uuid,p_session uuid) returns void language plpgsql set search_path='' as $$
begin
 if not exists(select 1 from public.leads_agents a join public.profiles p on p.id=a.user_id join public.user_access_grants g on g.user_id=a.user_id where a.user_id=p_actor and a.is_active and p.is_active and g.is_active and g.access_level='section' and g.allowed_sections @> array['leadsIntell']::text[]) then raise exception 'Agent access inactive'; end if;
 insert into public.leads_login_history(session_id,actor_id,logged_in_at) select id,user_id,created_at from auth.sessions where id=p_session and user_id=p_actor on conflict(session_id) do nothing;
 if not found and not exists(select 1 from public.leads_login_history where session_id=p_session and actor_id=p_actor) then raise exception 'Login session not found'; end if;
end;$$;
revoke all on function public.record_agent_login(uuid,uuid) from public,anon,authenticated;
grant execute on function public.record_agent_login(uuid,uuid) to service_role;
alter table public.leads_edit_history add column before_values jsonb, add column after_values jsonb;
create or replace function public.audit_lead_editor() returns trigger language plpgsql set search_path='' as $$
begin
 insert into public.leads_edit_history(lead_key,actor_id,response,callback_at,notes,before_values,after_values)
 values(new.lead_key,new.updated_by,new.response,new.callback_at,new.notes,
 case when TG_OP='UPDATE' then jsonb_build_object('response',old.response,'callback_at',old.callback_at,'notes',old.notes) else null end,
 jsonb_build_object('response',new.response,'callback_at',new.callback_at,'notes',new.notes));
 return new;
end;$$;
revoke execute on function public.audit_lead_editor() from public,anon,authenticated;
insert into public.leads_login_history(session_id,actor_id,logged_in_at)
select s.id,s.user_id,s.created_at from auth.sessions s join public.leads_agents a on a.user_id=s.user_id on conflict(session_id) do nothing;