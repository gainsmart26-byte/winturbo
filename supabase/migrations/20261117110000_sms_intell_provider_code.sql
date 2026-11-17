alter table public.sms_intell_dispatches
  add column provider_code text check (provider_code ~ '^[0-9]{3}$');
