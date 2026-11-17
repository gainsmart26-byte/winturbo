create table public.sms_intell_settings (
  id boolean primary key default true check (id),
  message text not null check (char_length(message) between 1 and 1000),
  template_id text not null check (template_id ~ '^[0-9]{1,40}$'),
  enabled_at timestamptz
);

create table public.sms_intell_dispatches (
  call_id text primary key,
  phone text not null,
  status text not null default 'unconfirmed'
    check (status in ('unconfirmed', 'http_ok', 'http_error')),
  http_status integer,
  created_at timestamptz not null default now()
);

alter table public.sms_intell_settings enable row level security;
alter table public.sms_intell_dispatches enable row level security;
revoke all on public.sms_intell_settings, public.sms_intell_dispatches from anon, authenticated;
grant select, insert, update on public.sms_intell_settings, public.sms_intell_dispatches to service_role;

create index sms_intell_dispatches_recent on public.sms_intell_dispatches (created_at desc);
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.schedule('sms-intell-poll', '*/5 * * * *', $cron$
  select net.http_post(
    url := 'https://kxspsqtdvngiovjvskuq.supabase.co/functions/v1/sms-intell',
    headers := jsonb_build_object('content-type', 'application/json', 'x-sms-worker-key', secret.decrypted_secret),
    body := '{"action":"poll"}'::jsonb,
    timeout_milliseconds := 120000
  )
  from vault.decrypted_secrets as secret
  where secret.name = 'sms_intell_worker_key'
    and exists (select 1 from public.sms_intell_settings where enabled_at is not null);
$cron$);
