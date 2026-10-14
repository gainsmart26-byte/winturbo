-- Date-range reporting for Admin Intelligence.
create or replace function public.get_admin_intelligence_summary_range(p_start_date date,p_end_date date)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare result jsonb; range_start timestamptz; range_end timestamptz;
begin
  if not exists(select 1 from public.profiles where id=auth.uid() and is_active and role='admin') then raise exception 'Admin access required'; end if;
  if p_start_date is null or p_end_date is null or p_end_date<p_start_date then raise exception 'Select a valid date range'; end if;
  if p_end_date-p_start_date>366 then raise exception 'Date range cannot exceed 366 days'; end if;
  range_start:=p_start_date::timestamp at time zone 'Asia/Kolkata';
  range_end:=(p_end_date+1)::timestamp at time zone 'Asia/Kolkata';
  select jsonb_build_object(
    'range',jsonb_build_object('start_date',p_start_date,'end_date',p_end_date),
    'totals',jsonb_build_object(
      'players',count(*),'active',count(*) filter(where status='active'),'blocked',count(*) filter(where status='blocked'),
      'ftd',count(*) filter(where ftd),'ftd_rate',round(100.0*count(*) filter(where ftd)/nullif(count(*),0),2),
      'lifetime_deposits',coalesce(sum(lifetime_deposits),0),'ggr',coalesce(sum(ggr),0),'ngr',coalesce(sum(ngr),0),
      'registrations_today',count(*) filter(where registered_at>=range_start and registered_at<range_end),
      'ftd_today',count(*) filter(where ftd_at>=range_start and ftd_at<range_end),
      'inactive_30d',count(*) filter(where last_deposit_at is null or last_deposit_at<now()-interval '30 days'),
      'high_value',count(*) filter(where lifetime_deposits>=100000),'negative_ggr',count(*) filter(where ggr<0),
      'deposits_today',coalesce((select sum(amount) from public.admin_deposit_events where detected_at>=range_start and detected_at<range_end),0),
      'depositors_today',coalesce((select count(distinct username) from public.admin_deposit_events where detected_at>=range_start and detected_at<range_end),0),
      'deposit_transactions_today',coalesce((select count(*) from public.admin_deposit_events where detected_at>=range_start and detected_at<range_end),0)
    ),
    'agents',(select coalesce(jsonb_agg(to_jsonb(a) order by a.ngr desc),'[]'::jsonb) from(
      select coalesce(agent->>'username','Unassigned') agent_name,count(*) players,count(*) filter(where ftd) ftd,
      round(100.0*count(*) filter(where ftd)/nullif(count(*),0),2) ftd_rate,coalesce(sum(lifetime_deposits),0) deposits,
      coalesce(sum(ggr),0) ggr,coalesce(sum(ngr),0) ngr from public.admin_players group by 1 order by ngr desc limit 50)a),
    'trend',(select coalesce(jsonb_agg(to_jsonb(t) order by t.date_value),'[]'::jsonb) from(
      select d::date date_value,
      (select count(*) from public.admin_players p where p.registered_at>=d and p.registered_at<d+interval '1 day') registrations,
      (select count(*) from public.admin_players p where p.ftd_at>=d and p.ftd_at<d+interval '1 day') ftd,
      (select coalesce(sum(e.amount),0) from public.admin_deposit_events e where e.detected_at>=d and e.detected_at<d+interval '1 day') deposit_amount,
      (select count(distinct e.username) from public.admin_deposit_events e where e.detected_at>=d and e.detected_at<d+interval '1 day') depositors
      from generate_series(range_start,range_end-interval '1 day',interval '1 day') d)t),
    'today_deposits',(select coalesce(jsonb_agg(to_jsonb(e) order by e.detected_at desc),'[]'::jsonb) from(
      select d.username,d.amount,d.detected_at,d.lifetime_after,p.phone,p.agent from public.admin_deposit_events d
      join public.admin_players p using(username) where d.detected_at>=range_start and d.detected_at<range_end
      order by d.detected_at desc limit 1000)e)
  ) into result from public.admin_players;
  return result;
end;$function$;
revoke all on function public.get_admin_intelligence_summary_range(date,date) from public,anon;
grant execute on function public.get_admin_intelligence_summary_range(date,date) to authenticated;
