create table public.ai_call_rules (
 id uuid primary key default gen_random_uuid(),name text not null check(length(name) between 1 and 120),
 agent_id uuid not null,case_type text not null check(case_type in ('callback','support','manual')),
 instructions text not null check(length(instructions) between 10 and 6000),language text not null default 'Hindi',
 lead_source text not null default '',response_filter text not null default '',daily_limit integer not null default 10 check(daily_limit between 1 and 50),
 start_hour integer not null default 10 check(start_hour between 9 and 19),end_hour integer not null default 18 check(end_hour between 10 and 20 and end_hour>start_hour),
 enabled boolean not null default false,created_by uuid references auth.users(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.ai_call_contacts (
 phone text primary key check(phone ~ '^\+[1-9][0-9]{7,14}$'),do_not_call boolean not null default true,reason text not null default '',updated_at timestamptz not null default now()
);
create table public.ai_call_jobs (
 id uuid primary key default gen_random_uuid(),rule_id uuid not null references public.ai_call_rules(id),lead_key text not null,phone text not null,
 call_day date not null default (now() at time zone 'Asia/Kolkata')::date,status text not null default 'ready',agent_id uuid not null,
 case_snapshot jsonb not null,permission_note text not null,created_by uuid references auth.users(id),created_at timestamptz not null default now(),
 claimed_at timestamptz,execution_id text unique,provider_status text,transcript text,summary text,recording_url text,duration_seconds numeric,reported_cost numeric,
 extracted_data jsonb,error text,synced_at timestamptz,unique(phone,call_day)
);
alter table public.ai_call_rules enable row level security;
alter table public.ai_call_contacts enable row level security;
alter table public.ai_call_jobs enable row level security;
create policy admin_rules on public.ai_call_rules for all to authenticated using(exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin' and is_active)) with check(exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin' and is_active));
create policy admin_contacts on public.ai_call_contacts for all to authenticated using(exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin' and is_active)) with check(exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin' and is_active));
create policy admin_jobs_read on public.ai_call_jobs for select to authenticated using(exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin' and is_active));
revoke all on public.ai_call_rules,public.ai_call_contacts,public.ai_call_jobs from anon,authenticated;
grant select,insert,update on public.ai_call_rules,public.ai_call_contacts to authenticated;
grant select on public.ai_call_jobs to authenticated;
grant all on public.ai_call_rules,public.ai_call_contacts,public.ai_call_jobs to service_role;
create index ai_call_jobs_created_idx on public.ai_call_jobs(created_at);
create index ai_call_jobs_rule_idx on public.ai_call_jobs(rule_id);
create or replace function public.ai_call_leads(p_rule uuid,p_search text default '',p_offset integer default 0)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare r public.ai_call_rules;outcome jsonb;
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and role='admin' and is_active) then raise exception 'Admin access required' using errcode='42501';end if;
 select * into r from public.ai_call_rules where id=p_rule;if not found then raise exception 'Select a saved case';end if;
 if p_offset<0 then raise exception 'Invalid page';end if;
 with eligible as (
 select l.lead_key,l.username,l.phone,l.lead_source,l.response,l.callback_at from public.lead_intell_records l
 where (r.lead_source='' or l.lead_source=r.lead_source) and (r.response_filter='' or l.response=r.response_filter)
 and (r.case_type<>'callback' or (l.response='Call Back' and l.callback_at<=now()))
 and coalesce(l.response,'') not in ('Connected Not Interested','Do Not Call','DND')
 and (p_search='' or position(lower(p_search) in lower(coalesce(l.username,'')||' '||coalesce(l.phone,'')))>0)
 ), page as(select * from eligible order by callback_at nulls last,lead_key limit 50 offset p_offset)
 select jsonb_build_object('total',(select count(*) from eligible),'rows',coalesce((select jsonb_agg(to_jsonb(p)) from page p),'[]'::jsonb)) into outcome;return outcome;
end $$;
revoke all on function public.ai_call_leads(uuid,text,integer) from public,anon;
grant execute on function public.ai_call_leads(uuid,text,integer) to authenticated;
create or replace function public.ai_call_claim(p_job uuid)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare j public.ai_call_jobs;r public.ai_call_rules;h int;d date;
begin
 perform pg_advisory_xact_lock(hashtextextended('ai-call-launch',0));
 select * into j from public.ai_call_jobs where id=p_job for update;
 if not found or j.status<>'ready' then return jsonb_build_object('error','Call is not ready or already launched');end if;
 select * into r from public.ai_call_rules where id=j.rule_id;
 if not r.enabled then return jsonb_build_object('error','This case is paused');end if;
 h:=extract(hour from now() at time zone 'Asia/Kolkata');d:=(now() at time zone 'Asia/Kolkata')::date;
 if h<r.start_hour or h>=r.end_hour then return jsonb_build_object('error','Outside the case calling hours (IST)');end if;
 if j.call_day<>d then return jsonb_build_object('error','Queue is from an earlier day; create a fresh reviewed queue');end if;
 if exists(select 1 from public.ai_call_contacts where phone=j.phone and do_not_call) then return jsonb_build_object('error','This number is on Do Not Call');end if;
 if (select count(*) from public.ai_call_jobs where rule_id=r.id and (claimed_at at time zone 'Asia/Kolkata')::date=d)>=r.daily_limit then return jsonb_build_object('error','Case daily call limit reached');end if;
 if (select count(*) from public.ai_call_jobs where (claimed_at at time zone 'Asia/Kolkata')::date=d)>=100 then return jsonb_build_object('error','Dashboard daily call limit reached');end if;
 update public.ai_call_jobs set status='dispatching',claimed_at=now() where id=j.id;
 return to_jsonb(j)||jsonb_build_object('status','dispatching');
end $$;
revoke all on function public.ai_call_claim(uuid) from public,anon,authenticated;
grant execute on function public.ai_call_claim(uuid) to service_role;
create or replace function public.ai_call_analytics(p_from date,p_to date)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare r jsonb;
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and role='admin' and is_active) then raise exception 'Admin access required' using errcode='42501';end if;
 if p_from is null or p_to is null or p_from>p_to or p_to-p_from>366 then raise exception 'Choose up to 367 days';end if;
 with j as(select * from public.ai_call_jobs where created_at>=p_from::timestamp at time zone 'Asia/Kolkata' and created_at<(p_to+1)::timestamp at time zone 'Asia/Kolkata'),
 statuses as(select coalesce(provider_status,status) label,count(*) value from j group by 1),daily as(select (created_at at time zone 'Asia/Kolkata')::date as day,count(*) value from j group by 1 order by 1)
 select jsonb_build_object('summary',jsonb_build_object('queued',(select count(*) from j where status='ready'),'submitted',(select count(*) from j where execution_id is not null),'completed',(select count(*) from j where provider_status='completed'),'not_answered',(select count(*) from j where provider_status in ('no-answer','busy')),'needs_review',(select count(*) from j where status in ('unknown','failed')),'minutes',(select round(sum(duration_seconds)/60,1) from j),'reported_cost',(select sum(reported_cost) from j)), 'statuses',coalesce((select jsonb_agg(to_jsonb(s)) from statuses s),'[]'::jsonb),'daily',coalesce((select jsonb_agg(to_jsonb(d)) from daily d),'[]'::jsonb)) into r;return r;
end $$;
revoke all on function public.ai_call_analytics(date,date) from public,anon;
grant execute on function public.ai_call_analytics(date,date) to authenticated;

