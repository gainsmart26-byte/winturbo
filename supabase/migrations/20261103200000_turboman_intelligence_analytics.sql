
alter table public.chatbot_knowledge add column if not exists keywords text[] not null default '{}', add column if not exists example_questions text[] not null default '{}';
alter table public.chatbot_sessions add column if not exists is_test boolean not null default false, add column if not exists resolution text not null default 'unreviewed';
alter table public.chatbot_messages add column if not exists channel text not null default 'text', add column if not exists record_type text not null default 'message', add column if not exists external_event_id text, add column if not exists response_ms integer, add column if not exists topic text, add column if not exists knowledge_gap boolean not null default false, add column if not exists verification_required boolean not null default false, add column if not exists error_code text;
create unique index if not exists chatbot_message_external_event_unique on public.chatbot_messages(session_id,external_event_id) where external_event_id is not null;
create index if not exists chatbot_messages_created_idx on public.chatbot_messages(created_at);
update public.chatbot_sessions set is_test=true where visitor_id in ('support-check-hindi-20261104','voice-support-check-20261104','support-qa-Tamil-20261104','support-qa-Telugu-20261104','support-qa-Hinglish-20261104','support-qa-Hindi-20261104','support-final-qa-Tamil-20261104','support-final-qa-Hindi-20261104','handoff-support-qa-20261104');
create or replace function public.turboman_search_knowledge(p_query text)
returns table(id uuid,title text,content text,language text,source_url text,keywords text[],example_questions text[],match_score numeric)
language sql security invoker set search_path=public as $$
 with scored as (
 select k.*,(
 case when lower(k.title)=lower(trim(p_query)) then 30 else 0 end+
 coalesce((select sum(8) from unnest(k.keywords) x where length(trim(x))>1 and position(lower(trim(x)) in lower(p_query))>0),0)+
 coalesce((select max(20) from unnest(k.example_questions) x where length(trim(x))>2 and (position(lower(trim(x)) in lower(p_query))>0 or position(lower(trim(p_query)) in lower(x))>0)),0)+
 ts_rank_cd(to_tsvector('simple',k.title||' '||k.content),websearch_to_tsquery('simple',left(coalesce(p_query,''),2000)))*10
 )::numeric score
 from public.chatbot_knowledge k where k.status='approved' and k.is_active
 )
 select s.id,s.title,s.content,s.language,s.source_url,s.keywords,s.example_questions,s.score
 from scored s order by s.score desc,s.updated_at desc limit 16;
$$;
revoke all on function public.turboman_search_knowledge(text) from public,anon;
grant execute on function public.turboman_search_knowledge(text) to authenticated,service_role;

create or replace function public.turboman_analytics(p_from date,p_to date,p_include_tests boolean default false)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare result jsonb;
begin
 if not exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active and p.role='admin') then raise exception 'Admin access required' using errcode='42501'; end if;
 if p_from is null or p_to is null or p_from>p_to or p_to-p_from>366 then raise exception 'Choose up to 367 days'; end if;
 with m as (
 select m.*,s.visitor_id,s.verified_user_id,s.origin,s.status,s.handoff_requested,s.resolution
 from public.chatbot_messages m join public.chatbot_sessions s on s.id=m.session_id
 where m.created_at>=p_from::timestamp at time zone 'Asia/Kolkata' and m.created_at<(p_to+1)::timestamp at time zone 'Asia/Kolkata' and (p_include_tests or not s.is_test)
 ), active_sessions as (select distinct session_id,visitor_id,verified_user_id,origin,status,handoff_requested,resolution from m),
 daily as(select (created_at at time zone 'Asia/Kolkata')::date as "day",count(*) filter(where role='user' and record_type in ('message','spoken_transcript')) customer_turns,count(distinct session_id) chats from m group by 1 order by 1),
 langs as(select case when language in ('Auto','') then 'Unknown / legacy' else language end label,count(*) value from m where role='user' and record_type in ('message','spoken_transcript') group by 1 order by 2 desc),
 origins as(select coalesce(origin,'Unknown') label,count(*) value from active_sessions group by 1 order by 2 desc),
 topics as(select coalesce(topic,'Unclassified / legacy') label,count(*) value from m where role='assistant' and record_type='message' group by 1 order by 2 desc),
 channels as(select channel label,count(*) value from m where role='user' and record_type in ('message','spoken_transcript') group by 1 order by 2 desc),
 hours as(select extract(hour from created_at at time zone 'Asia/Kolkata')::int as "hour",count(*) value from m where role='user' and record_type in ('message','spoken_transcript') group by 1 order by 1),
 questions as(select left(trim(content),200) question,count(*) count from m where role='user' and record_type in ('message','spoken_transcript') group by 1 order by 2 desc,1 limit 15),
 knowledge as(select k.id,k.title,count(*) retrieved_count from m cross join lateral jsonb_array_elements(m.sources) src join public.chatbot_knowledge k on k.id::text=src->>'id' where m.role='assistant' and m.record_type='message' group by k.id,k.title order by 3 desc limit 15)
 select jsonb_build_object(
 'summary',jsonb_build_object(
 'conversations',(select count(*) from active_sessions),'visitors',(select count(distinct visitor_id) from active_sessions),'verified_members',(select count(distinct verified_user_id) from active_sessions),
 'recorded_rows',(select count(*) from m),'customer_turns',(select count(*) from m where role='user' and record_type in ('message','spoken_transcript')),
 'answers',(select count(*) from m where role='assistant' and record_type='message'),'voice_turns',(select count(*) from m where role='user' and channel='voice' and record_type='spoken_transcript'),
 'handoffs',(select count(*) from active_sessions where handoff_requested),'open',(select count(*) from active_sessions where status='open'),'resolved',(select count(*) from active_sessions where resolution='resolved'),
 'knowledge_gaps',(select count(*) from m where knowledge_gap and role='assistant' and record_type='message'),'verification_requests',(select count(*) from m where verification_required and role='assistant' and record_type='message'),
 'recorded_errors',(select count(*) from m where error_code is not null),'avg_response_ms',(select round(avg(response_ms)) from m where role='assistant' and record_type='message'),
 'p95_response_ms',(select round(percentile_cont(.95) within group(order by response_ms)::numeric) from m where role='assistant' and record_type='message' and response_ms is not null)),
 'daily',coalesce((select jsonb_agg(to_jsonb(d)) from daily d),'[]'::jsonb),
 'languages',coalesce((select jsonb_agg(to_jsonb(l)) from langs l),'[]'::jsonb),
 'origins',coalesce((select jsonb_agg(to_jsonb(o)) from origins o),'[]'::jsonb),
 'topics',coalesce((select jsonb_agg(to_jsonb(t)) from topics t),'[]'::jsonb),
 'channels',coalesce((select jsonb_agg(to_jsonb(c)) from channels c),'[]'::jsonb),
 'hours',coalesce((select jsonb_agg(to_jsonb(h)) from hours h),'[]'::jsonb),
 'questions',coalesce((select jsonb_agg(to_jsonb(q)) from questions q),'[]'::jsonb),
 'knowledge',coalesce((select jsonb_agg(to_jsonb(k)) from knowledge k),'[]'::jsonb)
 ) into result;
 return result;
end $$;
revoke all on function public.turboman_analytics(date,date,boolean) from public,anon;
grant execute on function public.turboman_analytics(date,date,boolean) to authenticated;

create or replace function public.turboman_conversations(p_from date,p_to date,p_search text default '',p_status text default 'all',p_offset integer default 0,p_include_tests boolean default false)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare result jsonb;
begin
 if not exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active and p.role='admin') then raise exception 'Admin access required' using errcode='42501'; end if;
 if p_from is null or p_to is null or p_from>p_to or p_to-p_from>366 or p_offset<0 then raise exception 'Invalid filters';end if;
 with filtered as (
 select s.*, (select count(*) from public.chatbot_messages m where m.session_id=s.id) message_count,
 (select left(content,180) from public.chatbot_messages m where m.session_id=s.id and m.role='user' order by m.id desc limit 1) last_question
 from public.chatbot_sessions s
 where (p_include_tests or not s.is_test) and (p_status='all' or s.status=p_status)
 and exists(select 1 from public.chatbot_messages m where m.session_id=s.id and m.created_at>=p_from::timestamp at time zone 'Asia/Kolkata' and m.created_at<(p_to+1)::timestamp at time zone 'Asia/Kolkata')
 and (p_search='' or position(lower(p_search) in lower(s.id::text||' '||coalesce(s.origin,'')||' '||s.language))>0 or exists(select 1 from public.chatbot_messages m where m.session_id=s.id and position(lower(p_search) in lower(m.content))>0))
 ), page as(select * from filtered order by handoff_requested desc,last_message_at desc,id limit 30 offset p_offset)
 select jsonb_build_object('total',(select count(*) from filtered),'rows',coalesce((select jsonb_agg(to_jsonb(p)) from page p),'[]'::jsonb)) into result;
 return result;
end $$;
revoke all on function public.turboman_conversations(date,date,text,text,integer,boolean) from public,anon;
grant execute on function public.turboman_conversations(date,date,text,text,integer,boolean) to authenticated;

