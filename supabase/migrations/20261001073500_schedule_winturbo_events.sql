create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'refresh-winturbo-events') then
    perform cron.unschedule('refresh-winturbo-events');
  end if;
end $$;

select cron.schedule(
  'refresh-winturbo-events',
  '*/30 * * * *',
  $cron$
    select net.http_post(
      url := 'https://kxspsqtdvngiovjvskuq.supabase.co/functions/v1/collect-winturbo-events',
      headers := jsonb_build_object(
        'content-type', 'application/json',
        'authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4c3BzcXRkdm5naW92anZza3VxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyMDE1NDgsImV4cCI6MjEwNDc3NzU0OH0.oKcpPGHmLhCvl7j2L2mVrp2tYt_vR4jA9RzNX5XSs-w'
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 25000
    );
  $cron$
);
