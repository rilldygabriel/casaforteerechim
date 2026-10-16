-- Only the church's classified media members and approved administrators.
insert into public.member_groups (key,name,description,sort_order,active)
values ('midia','Mídia','Acesso à biblioteca Pronto para postar da igreja.',5,true)
on conflict (key) do nothing;

create or replace function public.can_access_media_library()
returns boolean language sql stable security invoker set search_path = ''
as $$
  select exists (
    select 1 from public.member_profiles p
    where p.user_id = (select auth.uid()) and p.approval_status = 'approved'
      and (p.is_admin or exists (
        select 1 from public.member_group_memberships m
        join public.member_groups g on g.key = m.group_key and g.active
        where m.member_id = p.user_id and m.group_key = 'midia'
      ))
  );
$$;
revoke all on function public.can_access_media_library() from public, anon;
grant execute on function public.can_access_media_library() to authenticated, service_role;

create table public.media_ready_posts (
  id uuid primary key,
  title text not null check (length(btrim(title)) between 1 and 160),
  caption text not null default '' check (length(caption) <= 30000),
  kind text not null check (kind in ('carousel','image','reel')),
  assets jsonb not null check (jsonb_typeof(assets) = 'array' and jsonb_array_length(assets) between 1 and 200),
  state text not null default 'uploading' check (state in ('uploading','ready')),
  posted boolean not null default false,
  posted_at timestamptz,
  posted_by uuid references auth.users(id),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((posted and posted_at is not null and posted_by is not null) or (not posted and posted_at is null and posted_by is null))
);
create index media_ready_posts_ready_created_idx on public.media_ready_posts (created_at desc,id) where state = 'ready';
create index media_ready_posts_created_by_idx on public.media_ready_posts (created_by);
create index media_ready_posts_posted_by_idx on public.media_ready_posts (posted_by);
alter table public.media_ready_posts enable row level security;
revoke all on public.media_ready_posts from anon, authenticated;
grant select on public.media_ready_posts to authenticated;
grant all on public.media_ready_posts to service_role;
create policy media_ready_posts_select on public.media_ready_posts for select to authenticated
using ((select public.can_access_media_library()) and (state = 'ready' or created_by = (select auth.uid())));
comment on table public.media_ready_posts is 'Church-only media library. Writes are validated by authenticated server routes; original files are private and immutable.';

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('casa-ready-media','casa-ready-media',false,5368709120,array['image/jpeg','image/png','image/webp','video/mp4','video/quicktime'])
on conflict (id) do nothing;
-- No blanket storage policies: authenticated server routes issue short-lived,
-- per-object signed URLs after current membership checks. No raw client writes.
