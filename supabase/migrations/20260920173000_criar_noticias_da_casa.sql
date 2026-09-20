alter table public.member_profiles
  add column if not exists can_manage_news boolean not null default false;

update public.member_profiles
set can_manage_news = true
where regexp_replace(coalesce(phone, ''), '\D', '', 'g') in (
  '54993217227',
  '54991619014'
);

comment on column public.member_profiles.can_manage_news is
  'Permite criar e editar notícias da Casa. Inicialmente restrito a Rilldy e Lisi.';

create table public.news_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  body text not null,
  status text not null default 'published',
  created_by uuid references auth.users(id) on delete set null,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint news_posts_slug_check
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and length(slug) between 3 and 120),
  constraint news_posts_title_check check (length(btrim(title)) between 3 and 140),
  constraint news_posts_body_check check (length(btrim(body)) between 3 and 2000),
  constraint news_posts_status_check check (status in ('published', 'draft'))
);

create index news_posts_published_at_idx
  on public.news_posts (published_at desc)
  where status = 'published';

create table public.news_images (
  id uuid primary key default gen_random_uuid(),
  news_id uuid not null references public.news_posts(id) on delete cascade,
  image_url text not null,
  storage_path text,
  position smallint not null,
  is_cover boolean not null default false,
  created_at timestamptz not null default now(),
  constraint news_images_position_check check (position between 0 and 4),
  constraint news_images_url_check check (length(image_url) between 3 and 2000),
  constraint news_images_storage_path_check check (storage_path is null or length(storage_path) between 3 and 500),
  unique (news_id, position)
);

create unique index news_images_one_cover_idx
  on public.news_images (news_id)
  where is_cover = true;

create index news_images_news_position_idx
  on public.news_images (news_id, position);

alter table public.news_posts enable row level security;
alter table public.news_images enable row level security;

revoke all on table public.news_posts, public.news_images from anon, authenticated;
grant select on table public.news_posts, public.news_images to anon, authenticated;
grant all on table public.news_posts, public.news_images to service_role;

create policy "Noticias publicadas sao publicas"
  on public.news_posts
  for select
  to anon, authenticated
  using (status = 'published');

create policy "Imagens de noticias publicadas sao publicas"
  on public.news_images
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.news_posts
      where news_posts.id = news_images.news_id
        and news_posts.status = 'published'
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'casa-news-images',
  'casa-news-images',
  true,
  3145728,
  array['image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

comment on table public.news_posts is
  'Notícias públicas da Igreja Casa Forte, criadas pelo painel autorizado.';
comment on table public.news_images is
  'Galeria com até cinco imagens por notícia; uma imagem é marcada como capa.';
