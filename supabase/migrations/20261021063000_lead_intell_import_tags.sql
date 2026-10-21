-- Tags are independent of WATI/manual attribution and registration status.
alter table public.lead_intell_records add column if not exists tags text[] not null default '{}'::text[];
