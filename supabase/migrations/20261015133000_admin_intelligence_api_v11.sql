-- Admin Intelligence support for Player Data API v1.1.
alter table public.admin_players
  add column if not exists deposit_count integer not null default 0,
  add column if not exists deposits_today_count integer not null default 0,
  add column if not exists deposits_today_amount numeric(18,2) not null default 0,
  add column if not exists withdrawal_count integer not null default 0,
  add column if not exists lifetime_withdrawals numeric(18,2) not null default 0,
  add column if not exists signup_ip inet,
  add column if not exists last_login_ip inet,
  add column if not exists signup_country text,
  add column if not exists signup_region text,
  add column if not exists signup_city text;

create table if not exists public.admin_deposit_transactions (
  id text primary key,
  username text not null,
  amount numeric(18,2) not null default 0,
  credited_amount numeric(18,2) not null default 0,
  status text not null,
  source text,
  requested_at timestamptz not null,
  completed_at timestamptz,
  synced_at timestamptz not null default now()
);
create index if not exists admin_deposit_transactions_completed_idx on public.admin_deposit_transactions(completed_at desc);
create index if not exists admin_deposit_transactions_username_idx on public.admin_deposit_transactions(username);

create table if not exists public.admin_withdrawal_transactions (
  id text primary key,
  username text not null,
  amount numeric(18,2) not null default 0,
  status text not null,
  source text,
  requested_at timestamptz not null,
  reviewed_at timestamptz,
  synced_at timestamptz not null default now()
);
create index if not exists admin_withdrawal_transactions_requested_idx on public.admin_withdrawal_transactions(requested_at desc);
create index if not exists admin_withdrawal_transactions_username_idx on public.admin_withdrawal_transactions(username);

alter table public.admin_deposit_transactions enable row level security;
alter table public.admin_withdrawal_transactions enable row level security;
revoke all on public.admin_deposit_transactions, public.admin_withdrawal_transactions from public, anon, authenticated;

create or replace function public.sync_admin_player_rows(payload jsonb)
returns jsonb language plpgsql set search_path='public'
as $function$
declare item jsonb; old_total numeric(18,2); new_total numeric(18,2); events_created integer:=0; rows_processed integer:=0;
begin
  for item in select * from jsonb_array_elements(payload) loop
    select lifetime_deposits into old_total from public.admin_players where username=item->>'username';
    new_total:=coalesce((item->>'lifetime_deposits')::numeric,0);
    insert into public.admin_players(
      username,phone,email,registered_at,status,ftd,ftd_at,last_deposit_at,lifetime_deposits,ggr,ngr,agent,upline,
      deposit_count,deposits_today_count,deposits_today_amount,withdrawal_count,lifetime_withdrawals,
      signup_ip,last_login_ip,signup_country,signup_region,signup_city,source_updated_at,synced_at
    ) values (
      item->>'username',nullif(item->>'phone',''),nullif(item->>'email',''),(item->>'registered_at')::timestamptz,item->>'status',
      coalesce((item->>'ftd')::boolean,false),nullif(item->>'ftd_at','')::timestamptz,nullif(item->>'last_deposit_at','')::timestamptz,
      new_total,coalesce((item->>'ggr')::numeric,0),coalesce((item->>'ngr')::numeric,0),item->'agent',coalesce(item->'upline','[]'::jsonb),
      coalesce((item->>'deposit_count')::integer,0),coalesce((item->>'deposits_today_count')::integer,0),coalesce((item->>'deposits_today_amount')::numeric,0),
      coalesce((item->>'withdrawal_count')::integer,0),coalesce((item->>'lifetime_withdrawals')::numeric,0),
      nullif(item->>'signup_ip','')::inet,nullif(item->>'last_login_ip','')::inet,nullif(item->>'signup_country',''),nullif(item->>'signup_region',''),nullif(item->>'signup_city',''),
      (item->>'source_updated_at')::timestamptz,coalesce(nullif(item->>'synced_at','')::timestamptz,now())
    ) on conflict(username) do update set
      phone=excluded.phone,email=excluded.email,registered_at=excluded.registered_at,status=excluded.status,ftd=excluded.ftd,ftd_at=excluded.ftd_at,
      last_deposit_at=excluded.last_deposit_at,lifetime_deposits=excluded.lifetime_deposits,ggr=excluded.ggr,ngr=excluded.ngr,agent=excluded.agent,upline=excluded.upline,
      deposit_count=excluded.deposit_count,deposits_today_count=excluded.deposits_today_count,deposits_today_amount=excluded.deposits_today_amount,
      withdrawal_count=excluded.withdrawal_count,lifetime_withdrawals=excluded.lifetime_withdrawals,signup_ip=excluded.signup_ip,last_login_ip=excluded.last_login_ip,
      signup_country=coalesce(excluded.signup_country,admin_players.signup_country),signup_region=coalesce(excluded.signup_region,admin_players.signup_region),
      signup_city=coalesce(excluded.signup_city,admin_players.signup_city),source_updated_at=excluded.source_updated_at,synced_at=excluded.synced_at;
    if old_total is not null and new_total>old_total then
      insert into public.admin_deposit_events(username,amount,detected_at,source_updated_at,lifetime_before,lifetime_after)
      values(item->>'username',new_total-old_total,now(),(item->>'source_updated_at')::timestamptz,old_total,new_total) on conflict do nothing;
      if found then events_created:=events_created+1; end if;
    end if;
    rows_processed:=rows_processed+1;
  end loop;
  return jsonb_build_object('rows_processed',rows_processed,'deposit_events_created',events_created);
end;$function$;

create or replace function public.get_admin_intelligence_summary_range(p_start_date date,p_end_date date)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare result jsonb; range_start timestamptz; range_end timestamptz;
begin
  if not exists(select 1 from public.profiles where id=auth.uid() and is_active and role='admin') then raise exception 'Admin access required'; end if;
  if p_start_date is null or p_end_date is null or p_end_date<p_start_date then raise exception 'Select a valid date range'; end if;
  if p_end_date-p_start_date>366 then raise exception 'Date range cannot exceed 366 days'; end if;
  range_start:=p_start_date::timestamp at time zone 'Asia/Kolkata'; range_end:=(p_end_date+1)::timestamp at time zone 'Asia/Kolkata';
  select jsonb_build_object(
    'range',jsonb_build_object('start_date',p_start_date,'end_date',p_end_date),
    'totals',jsonb_build_object(
      'players',count(*),'active',count(*) filter(where status='active'),'blocked',count(*) filter(where status='blocked'),
      'ftd',count(*) filter(where ftd),'ftd_rate',round(100.0*count(*) filter(where ftd)/nullif(count(*),0),2),
      'lifetime_deposits',coalesce(sum(lifetime_deposits),0),'lifetime_withdrawals',coalesce(sum(lifetime_withdrawals),0),
      'ggr',coalesce(sum(ggr),0),'ngr',coalesce(sum(ngr),0),
      'registrations_today',count(*) filter(where registered_at>=range_start and registered_at<range_end),
      'ftd_today',count(*) filter(where ftd_at>=range_start and ftd_at<range_end),
      'repeat_ftd_users',count(*) filter(where ftd and deposit_count>1),
      'repeat_ftd_percentage',round(100.0*count(*) filter(where ftd and deposit_count>1)/nullif(count(*) filter(where ftd),0),2),
      'inactive_30d',count(*) filter(where last_deposit_at is null or last_deposit_at<now()-interval '30 days'),
      'high_value',count(*) filter(where lifetime_deposits>=100000),'negative_ggr',count(*) filter(where ggr<0),
      'deposits_today',coalesce((select sum(credited_amount) from public.admin_deposit_transactions where status='CREDITED' and completed_at>=range_start and completed_at<range_end),0),
      'depositors_today',coalesce((select count(distinct username) from public.admin_deposit_transactions where status='CREDITED' and completed_at>=range_start and completed_at<range_end),0),
      'deposit_transactions_today',coalesce((select count(*) from public.admin_deposit_transactions where status='CREDITED' and completed_at>=range_start and completed_at<range_end),0),
      'withdrawals',coalesce((select sum(amount) from public.admin_withdrawal_transactions where status in ('APPROVED','PROCESSING','PAID') and requested_at>=range_start and requested_at<range_end),0),
      'withdrawal_users',coalesce((select count(distinct username) from public.admin_withdrawal_transactions where status in ('APPROVED','PROCESSING','PAID') and requested_at>=range_start and requested_at<range_end),0)
    ),
    'locations',(select coalesce(jsonb_agg(to_jsonb(l) order by l.registered_users desc),'[]'::jsonb) from(
      select coalesce(nullif(concat_ws(', ',nullif(signup_city,''),nullif(signup_region,''),nullif(signup_country,'')),''),'Unknown') location,
      count(*) filter(where registered_at>=range_start and registered_at<range_end) registered_users,
      count(*) filter(where ftd_at>=range_start and ftd_at<range_end) ftd_users
      from public.admin_players group by 1 having count(*) filter(where registered_at>=range_start and registered_at<range_end)>0 or count(*) filter(where ftd_at>=range_start and ftd_at<range_end)>0
      order by registered_users desc limit 50)l),
    'agents',(select coalesce(jsonb_agg(to_jsonb(a) order by a.ngr desc),'[]'::jsonb) from(
      select coalesce(agent->>'username','Unassigned') agent_name,count(*) players,count(*) filter(where ftd) ftd,
      round(100.0*count(*) filter(where ftd)/nullif(count(*),0),2) ftd_rate,coalesce(sum(lifetime_deposits),0) deposits,
      coalesce(sum(ggr),0) ggr,coalesce(sum(ngr),0) ngr from public.admin_players group by 1 order by ngr desc limit 50)a),
    'trend',(select coalesce(jsonb_agg(to_jsonb(t) order by t.date_value),'[]'::jsonb) from(
      select d::date date_value,
      (select count(*) from public.admin_players p where p.registered_at>=d and p.registered_at<d+interval '1 day') registrations,
      (select count(*) from public.admin_players p where p.ftd_at>=d and p.ftd_at<d+interval '1 day') ftd,
      (select coalesce(sum(x.credited_amount),0) from public.admin_deposit_transactions x where x.status='CREDITED' and x.completed_at>=d and x.completed_at<d+interval '1 day') deposit_amount,
      (select count(distinct x.username) from public.admin_deposit_transactions x where x.status='CREDITED' and x.completed_at>=d and x.completed_at<d+interval '1 day') depositors
      from generate_series(range_start,range_end-interval '1 day',interval '1 day') d)t),
    'today_deposits',(select coalesce(jsonb_agg(to_jsonb(e) order by e.completed_at desc),'[]'::jsonb) from(
      select d.username,d.credited_amount amount,d.completed_at detected_at,p.lifetime_deposits lifetime_after,p.phone,p.agent
      from public.admin_deposit_transactions d join public.admin_players p using(username)
      where d.status='CREDITED' and d.completed_at>=range_start and d.completed_at<range_end order by d.completed_at desc limit 1000)e)
  ) into result from public.admin_players;
  return result;
end;$function$;

revoke all on function public.get_admin_intelligence_summary_range(date,date) from public,anon;
grant execute on function public.get_admin_intelligence_summary_range(date,date) to authenticated;

create or replace function public.get_pnl_analysis(p_start_date date,p_end_date date)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare result jsonb; range_start timestamptz; range_end timestamptz; day_count integer;
begin
  if not exists(select 1 from public.profiles where id=auth.uid() and is_active and role='admin') then raise exception 'Admin access required'; end if;
  if p_start_date is null or p_end_date is null or p_end_date<p_start_date then raise exception 'Select a valid date range'; end if;
  if p_end_date-p_start_date>366 then raise exception 'Date range cannot exceed 366 days'; end if;
  range_start:=p_start_date::timestamp at time zone 'Asia/Kolkata'; range_end:=(p_end_date+1)::timestamp at time zone 'Asia/Kolkata'; day_count:=p_end_date-p_start_date+1;
  with metrics as (
    select
      coalesce((select sum(credited_amount) from public.admin_deposit_transactions where status='CREDITED' and completed_at>=range_start and completed_at<range_end),0) deposits,
      coalesce((select sum(amount) from public.admin_withdrawal_transactions where status in ('APPROVED','PROCESSING','PAID') and requested_at>=range_start and requested_at<range_end),0) withdrawals,
      coalesce((select sum(amount) from public.expenses where coalesce(expense_date,date '2026-10-14') between p_start_date and p_end_date),0) expenses,
      (select count(*) from public.admin_players where registered_at>=range_start and registered_at<range_end) registrations,
      (select count(*) from public.admin_players where ftd_at>=range_start and ftd_at<range_end) ftd,
      (select count(distinct username) from public.admin_deposit_transactions where status='CREDITED' and completed_at>=range_start and completed_at<range_end) depositors,
      (select count(distinct d.username) from public.admin_deposit_transactions d join public.admin_players p using(username)
       where d.status='CREDITED' and d.completed_at>=range_start and d.completed_at<range_end and p.ftd_at is not null and d.completed_at>p.ftd_at) retained_depositors
  ) select jsonb_build_object(
    'range',jsonb_build_object('start_date',p_start_date,'end_date',p_end_date,'days',day_count),
    'totals',jsonb_build_object('deposits',deposits,'withdrawals',withdrawals,'expenses',expenses,'net_profit_loss',deposits-withdrawals-expenses,
      'registrations',registrations,'ftd',ftd,'cost_per_registration',case when registrations>0 then round(expenses/registrations,2) end,
      'cost_per_ftd',case when ftd>0 then round(expenses/ftd,2) end,'average_daily_ftd',round(ftd::numeric/day_count,2),
      'average_daily_retention',case when depositors>0 then round(100.0*retained_depositors/depositors,2) end,
      'retained_depositors',retained_depositors,'depositors',depositors),
    'availability',jsonb_build_object('withdrawals',true,'net_profit_loss',true,'withdrawal_note','Approved, processing and paid withdrawals from the live Admin API.'),
    'generated_at',now()) into result from metrics;
  return result;
end;$function$;
revoke all on function public.get_pnl_analysis(date,date) from public,anon;
grant execute on function public.get_pnl_analysis(date,date) to authenticated;

-- Force one complete player refresh so v1.1 fields populate for existing accounts.
update public.admin_player_sync_state set last_server_time=null,updated_at=now() where id=true;
