CREATE OR REPLACE FUNCTION public.daily_management_report_metrics(p_report_date date)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
with bounds as (
  select
    (p_report_date::timestamp at time zone 'Asia/Kolkata') as start_at,
    ((p_report_date + 1)::timestamp at time zone 'Asia/Kolkata') as end_at
), daily as (
  select
    (select count(*) from admin_players p,bounds b where p.registered_at>=b.start_at and p.registered_at<b.end_at) daily_registrations,
    (select count(*) from admin_players) total_registrations,
    (select count(*) from admin_players p,bounds b where p.ftd_at>=b.start_at and p.ftd_at<b.end_at) daily_ftd,
    (select count(*) from admin_players where ftd=true) total_ftd,
    (select coalesce(sum(d.credited_amount),0) from admin_deposit_transactions d,bounds b where d.status='CREDITED' and d.completed_at>=b.start_at and d.completed_at<b.end_at) daily_deposits,
    (select count(distinct d.username) from admin_deposit_transactions d,bounds b where d.status='CREDITED' and d.completed_at>=b.start_at and d.completed_at<b.end_at) daily_depositors,
    (select coalesce(sum(w.amount),0) from admin_withdrawal_transactions w,bounds b where w.status in ('APPROVED','PROCESSING','PAID') and coalesce(w.reviewed_at,w.requested_at)>=b.start_at and coalesce(w.reviewed_at,w.requested_at)<b.end_at) daily_withdrawals,
    (select coalesce(sum(lifetime_withdrawals),0) from admin_players) total_withdrawals,
    (select coalesce(sum(lifetime_deposits),0) from admin_players where ftd=true) total_ftd_amount,
    (select coalesce(sum(e.amount),0) from expenses e where (lower(trim(e.expense_type)) in ('facebook ads','facebook ads us') or lower(trim(e.category))='facebook ads us')) facebook_spend_total,
    (select coalesce(sum(e.amount),0) from expenses e where lower(trim(e.expense_type))='google ads') google_spend_total,
    (select coalesce(sum(e.amount),0) from expenses e where lower(trim(e.expense_type))='telegram ads') telegram_spend_total,
    (select coalesce(sum(e.amount),0) from expenses e where (lower(trim(e.expense_type)) in ('facebook ads','facebook ads us') or lower(trim(e.category))='facebook ads us') and e.expense_date=p_report_date) facebook_spend_daily,
    (select coalesce(sum(e.amount),0) from expenses e where lower(trim(e.expense_type))='google ads' and e.expense_date=p_report_date) google_spend_daily,
    (select coalesce(sum(e.amount),0) from expenses e where lower(trim(e.expense_type))='telegram ads' and e.expense_date=p_report_date) telegram_spend_daily,
    (select count(*) from expenses e where (lower(trim(e.expense_type)) in ('facebook ads','facebook ads us','google ads','telegram ads') or lower(trim(e.category))='facebook ads us') and e.expense_date is not null) dated_expense_rows
)
select jsonb_build_object(
  'report_date',p_report_date,
  'timezone','Asia/Kolkata',
  'daily_registered_users',daily_registrations,
  'total_registered_users',total_registrations,
  'daily_ftd_users',daily_ftd,
  'total_ftd_users',total_ftd,
  'daily_deposit_amount',daily_deposits,
  'daily_depositors',daily_depositors,
  'average_deposit_per_user',case when daily_depositors>0 then round(daily_deposits/daily_depositors,2) end,
  'facebook_ad_spend_total',facebook_spend_total,
  'google_ad_spend_total',google_spend_total,
  'telegram_ad_spend_total',telegram_spend_total,
  'total_advertising_spend',facebook_spend_total+google_spend_total+telegram_spend_total,
  'facebook_ad_spend_daily',facebook_spend_daily,
  'google_ad_spend_daily',google_spend_daily,
  'telegram_ad_spend_daily',telegram_spend_daily,
  'daily_advertising_spend',facebook_spend_daily+google_spend_daily+telegram_spend_daily,
  'daily_spend_available',dated_expense_rows>0,
  'daily_withdrawal_amount',daily_withdrawals,
  'total_withdrawal_amount',total_withdrawals,
  'total_ftd_amount',total_ftd_amount,
  'cost_per_ftd',case when total_ftd>0 then round((facebook_spend_total+google_spend_total+telegram_spend_total)/total_ftd,2) end,
  'cost_per_registration',case when total_registrations>0 then round((facebook_spend_total+google_spend_total+telegram_spend_total)/total_registrations,2) end,
  'total_leads',null,
  'daily_leads',null,
  'leads_to_ftd_rate',null,
  'leads_to_registration_rate',null,
  'lead_source_status','Awaiting Google Sheet connection',
  'channel_spend',jsonb_build_object(
    'telegram_ads_total',telegram_spend_total,
    'telegram_ads_daily',telegram_spend_daily,
    'telegram_ads',telegram_spend_daily,
    'google_ads',google_spend_daily,
    'facebook_ads',facebook_spend_daily,
    'all_channels_total',facebook_spend_total+google_spend_total+telegram_spend_total,
    'all_channels_daily',facebook_spend_daily+google_spend_daily+telegram_spend_daily,
    'facebook_ads_total',facebook_spend_total,
    'google_ads_total',google_spend_total,
    'facebook_google_total',facebook_spend_total+google_spend_total,
    'facebook_ads_daily',facebook_spend_daily,
    'google_ads_daily',google_spend_daily,
    'facebook_google_daily',facebook_spend_daily+google_spend_daily
  )
) from daily;
$function$;

CREATE OR REPLACE FUNCTION public.get_admin_report_intelligence(p_start_date date, p_end_date date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare result jsonb;range_start timestamptz;range_end timestamptz;day_count int;
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and is_active and role='admin') then raise exception 'Admin access required';end if;
 if p_start_date is null or p_end_date is null or p_end_date<p_start_date then raise exception 'Select a valid date range';end if;
 if p_end_date-p_start_date>366 then raise exception 'Date range cannot exceed 366 days';end if;
 range_start:=p_start_date::timestamp at time zone 'Asia/Kolkata';range_end:=(p_end_date+1)::timestamp at time zone 'Asia/Kolkata';day_count:=p_end_date-p_start_date+1;
 with paid_expenses as(
  select e.id,
   case when (lower(trim(e.expense_type)) in ('facebook ads','facebook ads us') or lower(trim(e.category))='facebook ads us') then 'facebook_ads' when lower(trim(e.expense_type))='telegram ads' then 'telegram_ads' else 'google_ads' end platform,
   e.amount,e.category,e.purpose,e.source_sheet,e.source_row,e.created_at,
   coalesce(e.expense_date,date '2026-10-14') expense_date
  from public.expenses e
  where (lower(trim(e.expense_type)) in ('facebook ads','facebook ads us','google ads','telegram ads') or lower(trim(e.category))='facebook ads us')
    and coalesce(e.expense_date,date '2026-10-14') between p_start_date and p_end_date
 ),totals as(
  select coalesce((select sum(amount) from paid_expenses),0) spend,
   coalesce((select sum(amount) from paid_expenses where platform='facebook_ads'),0) facebook_spend,
   coalesce((select sum(amount) from paid_expenses where platform='google_ads'),0) google_spend,
   coalesce((select sum(amount) from paid_expenses where platform='telegram_ads'),0) telegram_spend,
   (select count(*) from public.admin_players where registered_at>=range_start and registered_at<range_end) registrations,
   (select count(*) from public.admin_players where ftd_at>=range_start and ftd_at<range_end and not exists(select 1 from public.admin_deposit_transactions ac where ac.username=admin_players.username and ac.completed_at=admin_players.ftd_at and ac.status='CREDITED' and ac.source='agent_credit')) ftd
 )
 select jsonb_build_object(
  'range',jsonb_build_object('start_date',p_start_date,'end_date',p_end_date,'days',day_count),
  'source','expenses',
  'legacy_cumulative_date','2026-10-14',
  'totals',jsonb_build_object(
   'spend',spend,'facebook_spend',facebook_spend,'google_spend',google_spend,'telegram_spend',telegram_spend,'registrations',registrations,'ftd',ftd,
   'cost_per_registration',case when registrations>0 then round(spend/registrations,2) end,
   'cost_per_ftd',case when ftd>0 then round(spend/ftd,2) end,
   'ftd_conversion',case when registrations>0 then round(100.0*ftd/registrations,2) end,
   'average_daily_spend',round(spend/day_count,2)),
  'expenses',(select coalesce(jsonb_agg(jsonb_build_object(
   'id',id,'expense_date',expense_date,'platform',platform,'campaign_name',coalesce(nullif(purpose,''),nullif(category,'')),
   'amount',amount,'notes',source_sheet||case when source_row is not null then ' · Row '||source_row else '' end,'created_at',created_at
  ) order by expense_date desc,source_row desc),'[]'::jsonb) from paid_expenses),
  'daily',(select coalesce(jsonb_agg(to_jsonb(d) order by d.date_value),'[]'::jsonb) from(
   select day::date date_value,
    coalesce((select sum(e.amount) from paid_expenses e where e.expense_date=day::date),0) spend,
    coalesce((select sum(e.amount) from paid_expenses e where e.expense_date=day::date and e.platform='facebook_ads'),0) facebook_spend,
    coalesce((select sum(e.amount) from paid_expenses e where e.expense_date=day::date and e.platform='google_ads'),0) google_spend,
    coalesce((select sum(e.amount) from paid_expenses e where e.expense_date=day::date and e.platform='telegram_ads'),0) telegram_spend,
    (select count(*) from public.admin_players p where p.registered_at>=day and p.registered_at<day+interval '1 day') registrations,
    (select count(*) from public.admin_players p where p.ftd_at>=day and p.ftd_at<day+interval '1 day' and not exists(select 1 from public.admin_deposit_transactions ac where ac.username=p.username and ac.completed_at=p.ftd_at and ac.status='CREDITED' and ac.source='agent_credit')) ftd
   from generate_series(range_start,range_end-interval '1 day',interval '1 day') day
  )d)
 ) into result from totals;
 return result||jsonb_build_object('financial_source','admin_api');
end;$function$;