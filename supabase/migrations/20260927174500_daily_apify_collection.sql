create table if not exists public.collection_runs (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  status text not null check (status in ('running','completed','partial','failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  summary jsonb not null default '{}'::jsonb,
  error_message text
);

alter table public.collection_runs enable row level security;

create index if not exists collection_runs_started_idx
  on public.collection_runs (started_at desc);

create or replace view public.posting_intelligence
with (security_invoker = true) as
with base as (
  select p.id, p.platform_post_id, p.post_url, p.post_text, p.posted_at,
    p.views, p.reactions_count, p.creative_score, a.account_name, a.handle,
    a.entity_category,
    extract(hour from p.posted_at at time zone 'Asia/Kolkata')::integer as post_hour_ist
  from public.posts p
  join public.accounts a on a.id = p.account_id
  where p.posted_at >= now() - interval '7 days'
), grouped as (
  select entity_category, post_hour_ist,
    lpad(post_hour_ist::text,2,'0') || ':00–' || lpad(((post_hour_ist+1)%24)::text,2,'0') || ':00' as post_hour_label,
    count(*) as posts_count, count(distinct handle) as competitors_posting,
    round(avg(views),2) as avg_views,
    percentile_cont(0.5) within group (order by views::double precision) as median_views,
    max(views) as top_views,
    round(avg(reactions_count) filter (where reactions_count is not null),2) as avg_reactions,
    round(avg(creative_score),2) as avg_creative_score,
    jsonb_agg(jsonb_build_object(
      'platform_post_id',platform_post_id,'post_url',post_url,
      'post_text',left(coalesce(post_text,''),120),'account_name',account_name,
      'handle',handle,'entity_category',entity_category,'posted_at',posted_at
    ) order by posted_at desc) as posts_detail
  from base group by entity_category,post_hour_ist
)
select dense_rank() over (partition by entity_category order by avg_views desc nulls last,posts_count desc) as performance_rank,
  post_hour_ist,post_hour_label,posts_count,competitors_posting,avg_views,median_views,
  top_views,avg_reactions,avg_creative_score,posts_detail,entity_category
from grouped;

-- Daily collection is scheduled through the connected Apify automation.
-- The Edge Function remains available for direct-token deployments.
