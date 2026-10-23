alter table public.lead_intell_records add column if not exists arrival_override_at timestamptz;
update public.lead_intell_records set arrival_override_at='2026-10-19T14:00:00+05:30' where lower(trim(lead_source))='manual' and created_at<'2026-10-24T00:00:00+05:30';
