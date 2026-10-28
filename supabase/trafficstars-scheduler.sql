-- Run after trafficstars-intelligence.sql. Vault retains the scheduler credential; it is never returned.
create table if not exists public.trafficstars_scheduler(id integer primary key check(id=1), secret_hash text not null);
alter table public.trafficstars_scheduler enable row level security;
revoke all on public.trafficstars_scheduler from public,anon,authenticated;
grant select on public.trafficstars_scheduler to service_role;
do $setup$
declare scheduler_secret text;
begin
 select decrypted_secret into scheduler_secret from vault.decrypted_secrets where name='trafficstars_scheduler_token' limit 1;
 if scheduler_secret is null then
  scheduler_secret:=encode(extensions.gen_random_bytes(32),'hex');
  perform vault.create_secret(scheduler_secret,'trafficstars_scheduler_token','Private credential for TrafficStars scheduled report fetch');
 end if;
 insert into public.trafficstars_scheduler(id,secret_hash) values(1,encode(extensions.digest(scheduler_secret,'sha256'),'hex')) on conflict(id) do update set secret_hash=excluded.secret_hash;
end;$setup$;
select cron.schedule('trafficstars-campaign-refresh','*/15 * * * *', $job$
 select net.http_post(
  url:='https://kxspsqtdvngiovjvskuq.supabase.co/functions/v1/trafficstars-intelligence',
  headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4c3BzcXRkdm5naW92anZza3VxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyMDE1NDgsImV4cCI6MjEwNDc3NzU0OH0.oKcpPGHmLhCvl7j2L2mVrp2tYt_vR4jA9RzNX5XSs-w','x-trafficstars-scheduler',(select decrypted_secret from vault.decrypted_secrets where name='trafficstars_scheduler_token' limit 1)),
  body:='{"action":"scheduled_report"}'::jsonb,
  timeout_milliseconds:=60000
 );
$job$);
