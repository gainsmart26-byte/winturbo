alter table public.chatbot_sessions
 add column if not exists contact_phone text,
 add column if not exists contact_phone_source text;
-- Existing admin-only RLS continues to protect the contact metadata.
comment on column public.chatbot_sessions.contact_phone is 'Contact attribution; does not grant account access.';
comment on column public.chatbot_sessions.contact_phone_source is 'verified_phone or registered_match (ownership not verified).';
-- Backfill only numbers with existing verified session evidence. Never infer guest phones.
update public.chatbot_sessions s set
 contact_phone=regexp_replace(u.phone,'[^0-9]','','g'),contact_phone_source='verified_phone'
from auth.users u where u.id=s.verified_user_id and u.phone_confirmed_at is not null
and regexp_replace(u.phone,'[^0-9]','','g') ~ '^91[6-9][0-9]{9}$' and s.contact_phone is null;
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
 and (p_search='' or position(lower(p_search) in lower(s.id::text||' '||coalesce(s.origin,'')||' '||s.language||' '||coalesce(s.contact_phone,'')))>0 or (length(regexp_replace(p_search,'[^0-9]','','g'))>=4 and position(regexp_replace(p_search,'[^0-9]','','g') in coalesce(s.contact_phone,''))>0) or exists(select 1 from public.chatbot_messages m where m.session_id=s.id and position(lower(p_search) in lower(m.content))>0))
 ), page as(select * from filtered order by handoff_requested desc,last_message_at desc,id limit 30 offset p_offset)
 select jsonb_build_object('total',(select count(*) from filtered),'rows',coalesce((select jsonb_agg(to_jsonb(p)) from page p),'[]'::jsonb)) into result;
 return result;
end $$;
revoke all on function public.turboman_conversations(date,date,text,text,integer,boolean) from public,anon;
grant execute on function public.turboman_conversations(date,date,text,text,integer,boolean) to authenticated;


