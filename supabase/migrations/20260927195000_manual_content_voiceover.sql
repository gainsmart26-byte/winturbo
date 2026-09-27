alter table public.publishing_queue
  add column if not exists content_format text,
  add column if not exists voiceover_mode text,
  add column if not exists voiceover_script text,
  add column if not exists voiceover_url text;

update storage.buckets
set allowed_mime_types = array[
  'image/png','image/jpeg','image/webp','video/mp4',
  'audio/mpeg','audio/mp3','audio/wav','audio/webm','audio/ogg'
]
where id = 'generated-media';

drop policy if exists "authenticated manual media uploads" on storage.objects;
create policy "authenticated manual media uploads" on storage.objects for insert to authenticated
with check (bucket_id='generated-media' and (storage.foldername(name))[1]='manual' and (storage.foldername(name))[2]=(select auth.uid()::text));

drop policy if exists "owners update manual media" on storage.objects;
create policy "owners update manual media" on storage.objects for update to authenticated
using (bucket_id='generated-media' and (storage.foldername(name))[1]='manual' and (storage.foldername(name))[2]=(select auth.uid()::text))
with check (bucket_id='generated-media' and (storage.foldername(name))[1]='manual' and (storage.foldername(name))[2]=(select auth.uid()::text));

