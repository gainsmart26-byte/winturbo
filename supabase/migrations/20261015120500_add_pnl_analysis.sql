create or replace function public.get_pnl_analysis(p_start_date date, p_end_date date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  result jsonb;
  range_start timestamptz;
  range_end timestamptz;
  day_count integer;
begin
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and is_active and role = 'admin'
  ) then
    raise exception 'Admin access required';
  end if;
  if p_start_date is null or p_end_date is null or p_end_date < p_start_date then
    raise exception 'Select a valid date range';
  end if;
  if p_end_date - p_start_date > 366 then
    raise exception 'Date range cannot exceed 366 days';
  end if;

  range_start := p_start_date::timestamp at time zone 'Asia/Kolkata';
  range_end := (p_end_date + 1)::timestamp at time zone 'Asia/Kolkata';
  day_count := p_end_date - p_start_date + 1;

  with metrics as (
    select
      coalesce((select sum(e.amount) from public.admin_deposit_events e where e.detected_at >= range_start and e.detected_at < range_end), 0) deposits,
      coalesce((select sum(e.amount) from public.expenses e where coalesce(e.expense_date, date '2026-10-14') between p_start_date and p_end_date), 0) expenses,
      (select count(*) from public.admin_players p where p.registered_at >= range_start and p.registered_at < range_end) registrations,
      (select count(*) from public.admin_players p where p.ftd_at >= range_start and p.ftd_at < range_end) ftd,
      (select count(distinct e.username) from public.admin_deposit_events e where e.detected_at >= range_start and e.detected_at < range_end) depositors,
      (select count(distinct e.username)
       from public.admin_deposit_events e
       join public.admin_players p using (username)
       where e.detected_at >= range_start and e.detected_at < range_end
         and p.ftd_at is not null
         and (e.detected_at at time zone 'Asia/Kolkata')::date > (p.ftd_at at time zone 'Asia/Kolkata')::date) retained_depositors
  )
  select jsonb_build_object(
    'range', jsonb_build_object('start_date', p_start_date, 'end_date', p_end_date, 'days', day_count),
    'totals', jsonb_build_object(
      'deposits', deposits,
      'withdrawals', null,
      'expenses', expenses,
      'net_profit_loss', null,
      'registrations', registrations,
      'ftd', ftd,
      'cost_per_registration', case when registrations > 0 then round(expenses / registrations, 2) end,
      'cost_per_ftd', case when ftd > 0 then round(expenses / ftd, 2) end,
      'average_daily_ftd', round(ftd::numeric / day_count, 2),
      'average_daily_retention', case when depositors > 0 then round(100.0 * retained_depositors / depositors, 2) end,
      'retained_depositors', retained_depositors,
      'depositors', depositors
    ),
    'availability', jsonb_build_object(
      'withdrawals', false,
      'net_profit_loss', false,
      'withdrawal_note', 'Withdrawal data is not available from the connected Admin API.'
    ),
    'generated_at', now()
  ) into result
  from metrics;

  return result;
end;
$function$;

revoke all on function public.get_pnl_analysis(date, date) from public, anon;
grant execute on function public.get_pnl_analysis(date, date) to authenticated;
