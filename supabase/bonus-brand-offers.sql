alter table public.bonus_intelligence_links add column if not exists offers jsonb not null default '[]'::jsonb;
