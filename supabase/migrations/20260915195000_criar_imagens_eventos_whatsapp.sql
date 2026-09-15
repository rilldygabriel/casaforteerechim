insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('casa-event-drafts', 'casa-event-drafts', false, 5242880, array['image/webp']),
  ('casa-event-images', 'casa-event-images', true, 5242880, array['image/webp'])
on conflict (id) do nothing;
