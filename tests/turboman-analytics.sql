begin;
select set_config('request.jwt.claim.sub',(select id::text from public.profiles where role='admin' and is_active limit 1),true);
insert into public.chatbot_sessions(id,visitor_id,origin,is_test,language) values('00000000-0000-4000-8000-000000009901','analytics-transaction-fixture','qa.invalid',true,'Hindi');
insert into public.chatbot_messages(session_id,role,content,created_at,channel,record_type,response_ms,language) values
('00000000-0000-4000-8000-000000009901','user','Before IST midnight','2099-01-01 18:29:59Z','text','message',null,'Hindi'),
('00000000-0000-4000-8000-000000009901','user','Spoken question','2099-01-01 18:30:00Z','voice','spoken_transcript',null,'Hindi'),
('00000000-0000-4000-8000-000000009901','user','Internal tool question','2099-01-01 18:30:01Z','voice','tool_question',null,'Hindi'),
('00000000-0000-4000-8000-000000009901','assistant','Grounded answer','2099-01-01 18:30:02Z','voice','message',1500,'Hindi');
insert into public.chatbot_knowledge(title,content,status,is_active,keywords,example_questions) values('QA search sentinel','Only for transaction test.','approved',true,array['qauniquekeyword'],array['How does qaunique work?']),('QA draft sentinel','Must never be retrieved.','draft',true,array['qauniquekeyword'],array[]::text[]);
set local role authenticated;
do $$ declare r jsonb;begin
r:=public.turboman_analytics('2099-01-02','2099-01-02',true);
if (r->'summary'->>'customer_turns')::int<>1 or (r->'summary'->>'voice_turns')::int<>1 or (r->'summary'->>'answers')::int<>1 or (r->'summary'->>'avg_response_ms')::int<>1500 then raise exception 'Analytics turn or timezone counts failed';end if;
r:=public.turboman_analytics('2099-01-02','2099-01-02',false);if (r->'summary'->>'conversations')::int<>0 then raise exception 'QA exclusion failed';end if;
if not exists(select 1 from public.turboman_search_knowledge('qauniquekeyword') where title='QA search sentinel' and match_score>=8) or exists(select 1 from public.turboman_search_knowledge('qauniquekeyword') where title='QA draft sentinel') then raise exception 'Knowledge matching/approval failed';end if;
end $$;
select 'PASS IST day boundary, voice deduplication, latency, test exclusion, keyword matching and draft exclusion' result;
rollback;
