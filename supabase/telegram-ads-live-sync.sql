alter table public.telegram_ad_accounts add column if not exists external_account_id text;
create unique index if not exists telegram_ad_accounts_external_id on public.telegram_ad_accounts(external_account_id) where external_account_id is not null;
create table if not exists public.telegram_ads_sync_control (
 id integer primary key check(id=1),
 scheduler_hash text not null,
 running_since timestamptz,
 last_error text,
 last_success_at timestamptz
);
alter table public.telegram_ads_sync_control enable row level security;
revoke all on public.telegram_ads_sync_control from anon, authenticated;
grant select,insert,update on public.telegram_ads_sync_control to service_role;
do $$
declare token text;
begin
 select decrypted_secret into token from vault.decrypted_secrets where name='telegram_ads_scheduler_token' limit 1;
 if token is null then
  token:=encode(extensions.gen_random_bytes(32),'hex');
  perform vault.create_secret(token,'telegram_ads_scheduler_token');
 end if;
 insert into public.telegram_ads_sync_control(id,scheduler_hash)
 values(1,encode(extensions.digest(token,'sha256'),'hex'))
 on conflict(id) do nothing;
end $$;

do $$
begin
 if not exists(select 1 from vault.decrypted_secrets where name='telegram_ads_publishable_key') then
  perform vault.create_secret((select substring(command from 'eyJ[A-Za-z0-9_.-]+') from cron.job where jobname='trafficstars-campaign-refresh'),'telegram_ads_publishable_key');
 end if;
end $$;
select cron.schedule('telegram-ads-live-refresh','*/15 * * * *',$job$
select net.http_post(
 url:='https://kxspsqtdvngiovjvskuq.supabase.co/functions/v1/telegram-ads-sync',
 headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='telegram_ads_publishable_key'),'x-telegram-scheduler',(select decrypted_secret from vault.decrypted_secrets where name='telegram_ads_scheduler_token')),
 body:='{"action":"scheduled_sync"}'::jsonb,
 timeout_milliseconds:=120000);
$job$);