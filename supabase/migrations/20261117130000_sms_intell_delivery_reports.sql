alter table public.sms_intell_dispatches
  add column provider_message_id text,
  add column delivery_status text,
  add column delivery_time text,
  add column delivery_checked_at timestamptz;
