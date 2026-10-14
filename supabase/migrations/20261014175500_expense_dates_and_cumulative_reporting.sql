alter table public.expenses add column if not exists expense_date date;

create or replace function public.replace_expense_sheet_rows(p_rows jsonb)
returns integer language plpgsql security definer set search_path=''
as $function$
declare inserted_count integer;
begin
  if current_user not in ('service_role','postgres','supabase_admin') then raise exception 'Service role required'; end if;
  perform pg_advisory_xact_lock(hashtext('winturbo_expense_sheet_sync'));
  delete from public.expenses where source_sheet='Expense Sheet';
  insert into public.expenses(source_key,expense_type,amount,category,purpose,source_sheet,source_row,expense_date,synced_at,updated_at)
  select x.source_key,x.expense_type,x.amount,x.category,x.purpose,x.source_sheet,x.source_row,x.expense_date,x.synced_at,x.updated_at
  from jsonb_to_recordset(coalesce(p_rows,'[]'::jsonb)) as x(source_key text,expense_type text,amount numeric,category text,purpose text,source_sheet text,source_row integer,expense_date date,synced_at timestamptz,updated_at timestamptz);
  get diagnostics inserted_count = row_count;
  return inserted_count;
end;$function$;
revoke all on function public.replace_expense_sheet_rows(jsonb) from public,anon,authenticated;
grant execute on function public.replace_expense_sheet_rows(jsonb) to service_role;

create or replace function public.get_admin_report_intelligence(p_start_date date,p_end_date date)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare result jsonb;range_start timestamptz;range_end timestamptz;day_count int;
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and is_active and role='admin') then raise exception 'Admin access required';end if;
 if p_start_date is null or p_end_date is null or p_end_date<p_start_date then raise exception 'Select a valid date range';end if;
 if p_end_date-p_start_date>366 then raise exception 'Date range cannot exceed 366 days';end if;
 range_start:=p_start_date::timestamp at time zone 'Asia/Kolkata';range_end:=(p_end_date+1)::timestamp at time zone 'Asia/Kolkata';day_count:=p_end_date-p_start_date+1;
 with paid_expenses as(
  select e.id,case when lower(trim(e.expense_type))='facebook ads' then 'facebook_ads' else 'google_ads' end platform,
   e.amount,e.category,e.purpose,e.source_sheet,e.source_row,e.created_at,coalesce(e.expense_date,date '2026-10-14') expense_date
  from public.expenses e where lower(trim(e.expense_type)) in ('facebook ads','google ads')
   and coalesce(e.expense_date,date '2026-10-14') between p_start_date and p_end_date
 ),totals as(
  select coalesce((select sum(amount) from paid_expenses),0) spend,
   coalesce((select sum(amount) from paid_expenses where platform='facebook_ads'),0) facebook_spend,
   coalesce((select sum(amount) from paid_expenses where platform='google_ads'),0) google_spend,
   (select count(*) from public.admin_players where registered_at>=range_start and registered_at<range_end) registrations,
   (select count(*) from public.admin_players where ftd_at>=range_start and ftd_at<range_end) ftd)
 select jsonb_build_object(
  'range',jsonb_build_object('start_date',p_start_date,'end_date',p_end_date,'days',day_count),'source','expenses','legacy_cumulative_date','2026-10-14',
  'totals',jsonb_build_object('spend',spend,'facebook_spend',facebook_spend,'google_spend',google_spend,'registrations',registrations,'ftd',ftd,
   'cost_per_registration',case when registrations>0 then round(spend/registrations,2) end,'cost_per_ftd',case when ftd>0 then round(spend/ftd,2) end,
   'ftd_conversion',case when registrations>0 then round(100.0*ftd/registrations,2) end,'average_daily_spend',round(spend/day_count,2)),
  'expenses',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'expense_date',expense_date,'platform',platform,'campaign_name',coalesce(nullif(purpose,''),nullif(category,'')),'amount',amount,'notes',source_sheet||case when source_row is not null then ' · Row '||source_row else '' end,'created_at',created_at) order by expense_date desc,source_row desc),'[]'::jsonb) from paid_expenses),
  'daily',(select coalesce(jsonb_agg(to_jsonb(d) order by d.date_value),'[]'::jsonb) from(
   select day::date date_value,coalesce((select sum(e.amount) from paid_expenses e where e.expense_date=day::date),0) spend,
    coalesce((select sum(e.amount) from paid_expenses e where e.expense_date=day::date and e.platform='facebook_ads'),0) facebook_spend,
    coalesce((select sum(e.amount) from paid_expenses e where e.expense_date=day::date and e.platform='google_ads'),0) google_spend,
    (select count(*) from public.admin_players p where p.registered_at>=day and p.registered_at<day+interval '1 day') registrations,
    (select count(*) from public.admin_players p where p.ftd_at>=day and p.ftd_at<day+interval '1 day') ftd
   from generate_series(range_start,range_end-interval '1 day',interval '1 day') day)d)
 ) into result from totals;
 return result;
end;$function$;
revoke all on function public.get_admin_report_intelligence(date,date) from public,anon;
grant execute on function public.get_admin_report_intelligence(date,date) to authenticated;
