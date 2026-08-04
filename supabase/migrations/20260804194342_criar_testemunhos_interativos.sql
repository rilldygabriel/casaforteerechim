create table public.testimonials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null check (char_length(author_name) between 2 and 160),
  author_photo_path text,
  title text not null check (char_length(title) between 3 and 120),
  body text not null check (char_length(body) between 10 and 3000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.testimonial_likes (
  testimonial_id uuid not null references public.testimonials(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (testimonial_id, user_id)
);

create table public.testimonial_comments (
  id uuid primary key default gen_random_uuid(),
  testimonial_id uuid not null references public.testimonials(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null check (char_length(author_name) between 2 and 160),
  body text not null check (char_length(body) between 1 and 800),
  created_at timestamptz not null default now()
);

create index testimonials_created_at_idx on public.testimonials (created_at desc);
create index testimonials_user_id_idx on public.testimonials (user_id);
create index testimonial_likes_user_id_idx on public.testimonial_likes (user_id);
create index testimonial_comments_testimonial_created_idx on public.testimonial_comments (testimonial_id, created_at);
create index testimonial_comments_user_id_idx on public.testimonial_comments (user_id);

alter table public.testimonials enable row level security;
alter table public.testimonial_likes enable row level security;
alter table public.testimonial_comments enable row level security;

grant select on public.testimonials, public.testimonial_likes, public.testimonial_comments to anon, authenticated;
grant all on public.testimonials, public.testimonial_likes, public.testimonial_comments to service_role;

create policy "Testemunhos publicados podem ser lidos"
on public.testimonials for select to anon, authenticated using (true);

create policy "Curtidas de testemunhos podem ser lidas"
on public.testimonial_likes for select to anon, authenticated using (true);

create policy "Comentarios de testemunhos podem ser lidos"
on public.testimonial_comments for select to anon, authenticated using (true);
