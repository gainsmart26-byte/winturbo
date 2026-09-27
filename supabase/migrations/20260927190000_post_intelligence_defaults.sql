create or replace function public.set_post_intelligence_defaults()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  normalized_type text := lower(coalesce(nullif(new.media_type, ''), 'post'));
  text_points numeric := case
    when length(coalesce(new.post_text, '')) >= 40 then 10
    when length(coalesce(new.post_text, '')) > 0 then 5
    else 0
  end;
begin
  if new.theme is null or btrim(new.theme) = '' or lower(new.theme) = 'unclassified' then
    new.theme := case
      when normalized_type like '%reel%' then 'Reel'
      when normalized_type like '%video%' then 'Video Post'
      when normalized_type like '%carousel%' or normalized_type like '%sidecar%' then 'Carousel Post'
      when normalized_type like '%image%' or normalized_type like '%photo%' then 'Image Post'
      when normalized_type = 'text' then 'Text Post'
      when normalized_type = 'media' then 'Media Post'
      else initcap(replace(normalized_type, '_', ' ')) || ' Post'
    end;
  end if;

  if new.creative_score is null then
    new.creative_score := round(least(100::numeric,
      30::numeric
      + least(45::numeric, (ln(greatest(coalesce(new.views, 0), 0) + 1) * 5)::numeric)
      + case when new.reactions_count is null then 0 else least(15::numeric, (ln(greatest(new.reactions_count, 0) + 1) * 3)::numeric) end
      + text_points
    ), 1);
  end if;
  return new;
end;
$$;

drop trigger if exists posts_intelligence_defaults on public.posts;
create trigger posts_intelligence_defaults
before insert or update of media_type, theme, creative_score, views, reactions_count, post_text
on public.posts
for each row execute function public.set_post_intelligence_defaults();

revoke all on function public.set_post_intelligence_defaults() from public, anon, authenticated;
grant execute on function public.set_post_intelligence_defaults() to service_role;

update public.posts
set
  theme = null,
  creative_score = null
where posted_at >= now() - interval '30 days'
  and (
    theme is null
    or btrim(theme) = ''
    or lower(theme) = 'unclassified'
    or creative_score is null
  );
