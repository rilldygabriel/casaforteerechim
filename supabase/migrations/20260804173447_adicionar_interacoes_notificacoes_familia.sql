create table public.family_announcement_likes (
  announcement_id uuid not null references public.family_announcements(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (announcement_id, user_id)
);

create index family_announcement_likes_user_id_idx
  on public.family_announcement_likes (user_id);

alter table public.family_announcement_likes enable row level security;
revoke all on table public.family_announcement_likes from anon, authenticated;
grant select on table public.family_announcement_likes to authenticated;

create policy "Membros aprovados veem curtidas dos avisos"
  on public.family_announcement_likes for select to authenticated
  using (
    exists (
      select 1 from public.member_profiles
      where member_profiles.user_id = (select auth.uid())
        and (member_profiles.approval_status = 'approved' or member_profiles.is_admin = true)
    )
  );

create table public.family_announcement_comments (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.family_announcements(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null,
  body text not null,
  created_at timestamptz not null default now(),
  constraint family_announcement_comments_author_check check (length(btrim(author_name)) between 2 and 160),
  constraint family_announcement_comments_body_check check (length(btrim(body)) between 1 and 800)
);

create index family_announcement_comments_announcement_idx
  on public.family_announcement_comments (announcement_id, created_at);
create index family_announcement_comments_user_id_idx
  on public.family_announcement_comments (user_id);

alter table public.family_announcement_comments enable row level security;
revoke all on table public.family_announcement_comments from anon, authenticated;
grant select on table public.family_announcement_comments to authenticated;

create policy "Membros aprovados veem comentarios dos avisos"
  on public.family_announcement_comments for select to authenticated
  using (
    exists (
      select 1 from public.member_profiles
      where member_profiles.user_id = (select auth.uid())
        and (member_profiles.approval_status = 'approved' or member_profiles.is_admin = true)
    )
  );

comment on table public.family_announcement_likes is
  'Curtidas dos membros nos avisos da Área da Família.';
comment on table public.family_announcement_comments is
  'Comentários dos membros nos avisos da Área da Família.';
