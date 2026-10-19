create table if not exists public.leads_agents (
 user_id uuid primary key references auth.users(id) on delete cascade,
 phone text not null unique check(phone ~ '^\+[1-9][0-9]{7,14}$'),
 name text not null check(length(name) between 1 and 100),
 is_active boolean not null default true,
 created_by uuid references auth.users(id), created_at timestamptz not null default now()
);
alter table public.leads_agents enable row level security;
revoke all on public.leads_agents from anon,authenticated;
grant select on public.leads_agents to authenticated;
do $policy$ begin if not exists(select 1 from pg_policies where schemaname='public' and tablename='leads_agents' and policyname='leads_agents_read') then create policy leads_agents_read on public.leads_agents for select to authenticated using(user_id=(select auth.uid()) or exists(select 1 from public.profiles where id=(select auth.uid()) and is_active and role='admin')); end if; end $policy$;
create table if not exists public.leads_agent_sessions (
 user_id uuid primary key references public.leads_agents(user_id) on delete cascade,
 lead_key text not null, edit_token uuid not null default gen_random_uuid(), expires_at timestamptz not null
);
alter table public.leads_agent_sessions enable row level security;
revoke all on public.leads_agent_sessions from anon,authenticated;
alter table public.lead_intell_records add column if not exists updated_by uuid references auth.users(id);
create index if not exists lead_intell_updated_by_idx on public.lead_intell_records(updated_by);
create table if not exists public.leads_edit_history (
 id bigint generated always as identity primary key,
 lead_key text not null, actor_id uuid references auth.users(id),
 response text, callback_at timestamptz, notes text,
 changed_at timestamptz not null default now()
);
alter table public.leads_edit_history enable row level security;
revoke all on public.leads_edit_history from anon,authenticated;
grant select,insert on public.leads_edit_history to authenticated;
grant usage on sequence public.leads_edit_history_id_seq to authenticated;
do $policy$ begin if not exists(select 1 from pg_policies where schemaname='public' and tablename='leads_edit_history' and policyname='leads_history_admin_read') then create policy leads_history_admin_read on public.leads_edit_history for select to authenticated using(exists(select 1 from public.profiles where id=(select auth.uid()) and is_active and role='admin')); end if; end $policy$;
do $policy$ begin if not exists(select 1 from pg_policies where schemaname='public' and tablename='leads_edit_history' and policyname='leads_history_admin_insert') then create policy leads_history_admin_insert on public.leads_edit_history for insert to authenticated with check(actor_id=(select auth.uid()) and exists(select 1 from public.profiles where id=(select auth.uid()) and is_active and role='admin')); end if; end $policy$;
create index if not exists leads_history_actor_idx on public.leads_edit_history(actor_id,changed_at desc);
create index if not exists leads_history_key_idx on public.leads_edit_history(lead_key,changed_at desc);
create or replace function public.stamp_lead_editor() returns trigger language plpgsql set search_path='' as $$
begin
 new.updated_by=coalesce(auth.uid(),new.updated_by);new.updated_at=now();return new;
end;$$;
do $trigger$ begin if not exists(select 1 from pg_trigger where tgname='stamp_lead_editor' and tgrelid='public.lead_intell_records'::regclass) then create trigger stamp_lead_editor before insert or update on public.lead_intell_records for each row execute function public.stamp_lead_editor(); end if; end $trigger$;
create or replace function public.audit_lead_editor() returns trigger language plpgsql set search_path='' as $$
begin
 insert into public.leads_edit_history(lead_key,actor_id,response,callback_at,notes) values(new.lead_key,new.updated_by,new.response,new.callback_at,new.notes);return new;
end;$$;
do $trigger$ begin if not exists(select 1 from pg_trigger where tgname='audit_lead_editor' and tgrelid='public.lead_intell_records'::regclass) then create trigger audit_lead_editor after insert or update on public.lead_intell_records for each row execute function public.audit_lead_editor(); end if; end $trigger$;
revoke execute on function public.stamp_lead_editor(), public.audit_lead_editor() from public,anon,authenticated;
-- Only the authenticated gateway may save an agent's currently open lead.
create or replace function public.save_agent_lead(p_actor uuid,p_key text,p_token uuid,p_username text,p_phone text,p_response text,p_callback timestamptz,p_notes text) returns jsonb language plpgsql set search_path='' as $$
declare result public.lead_intell_records;
begin
 if not exists(select 1 from public.leads_agents a join public.profiles p on p.id=a.user_id where a.user_id=p_actor and a.is_active and p.is_active and p.role<>'admin') then raise exception 'Agent access inactive';end if;
 perform 1 from public.leads_agent_sessions where user_id=p_actor and lead_key=p_key and edit_token=p_token and expires_at>now() for update;
 if not found then raise exception 'Reopen this lead before saving';end if;
 insert into public.lead_intell_records(lead_key,username,phone,response,callback_at,notes,updated_by)
 values(p_key,p_username,p_phone,p_response,p_callback,p_notes,p_actor)
 on conflict(lead_key) do update set response=excluded.response,callback_at=excluded.callback_at,notes=excluded.notes,updated_by=excluded.updated_by
 returning * into result;
 return to_jsonb(result);
end;$$;
revoke all on function public.save_agent_lead(uuid,text,uuid,text,text,text,timestamptz,text) from public,anon,authenticated;
grant execute on function public.save_agent_lead(uuid,text,uuid,text,text,text,timestamptz,text) to service_role;
create index if not exists leads_agents_created_by_idx on public.leads_agents(created_by);
do $policy$ begin if not exists(select 1 from pg_policies where schemaname='public' and tablename='leads_agent_sessions' and policyname='leads_sessions_no_client') then create policy leads_sessions_no_client on public.leads_agent_sessions for all to authenticated using(false) with check(false); end if; end $policy$;
