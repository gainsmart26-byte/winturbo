create or replace function public.get_admin_time_slot_analysis(p_start_date date,p_end_date date)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare result jsonb;range_start timestamptz;range_end timestamptz;
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and is_active and role='admin') then raise exception 'Admin access required';end if;
 if p_start_date is null or p_end_date is null or p_end_date<p_start_date then raise exception 'Select a valid date range';end if;
 if p_end_date-p_start_date>366 then raise exception 'Date range cannot exceed 366 days';end if;
 range_start:=p_start_date::timestamp at time zone 'Asia/Kolkata';range_end:=(p_end_date+1)::timestamp at time zone 'Asia/Kolkata';
 select coalesce(jsonb_agg(jsonb_build_object(
  'hour',h,'label',to_char(make_time(h,0,0),'HH12 AM'),
  'registrations',(select count(*) from public.admin_players p where p.registered_at>=range_start and p.registered_at<range_end and extract(hour from p.registered_at at time zone 'Asia/Kolkata')=h),
  'ftd',(select count(*) from public.admin_players p where p.ftd_at>=range_start and p.ftd_at<range_end and extract(hour from p.ftd_at at time zone 'Asia/Kolkata')=h),
  'deposit_amount',(select coalesce(sum(e.amount),0) from public.admin_deposit_events e where e.detected_at>=range_start and e.detected_at<range_end and extract(hour from e.detected_at at time zone 'Asia/Kolkata')=h),
  'depositors',(select count(distinct e.username) from public.admin_deposit_events e where e.detected_at>=range_start and e.detected_at<range_end and extract(hour from e.detected_at at time zone 'Asia/Kolkata')=h)
 ) order by h),'[]'::jsonb) into result from generate_series(0,23) h;
 return result;
end;$function$;
revoke all on function public.get_admin_time_slot_analysis(date,date) from public,anon;
grant execute on function public.get_admin_time_slot_analysis(date,date) to authenticated;
