create table public.family_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  constraint family_announcements_title_check check (length(btrim(title)) between 3 and 100),
  constraint family_announcements_body_check check (length(btrim(body)) between 3 and 2000)
);

create index family_announcements_created_at_idx
  on public.family_announcements (created_at desc);

alter table public.family_announcements enable row level security;
revoke all on table public.family_announcements from anon;
grant select, insert, delete on table public.family_announcements to authenticated;

create policy "Membros aprovados leem avisos da Familia"
  on public.family_announcements for select to authenticated
  using (
    exists (
      select 1 from public.member_profiles
      where member_profiles.user_id = (select auth.uid())
        and (member_profiles.approval_status = 'approved' or member_profiles.is_admin = true)
    )
  );

create policy "Administradores publicam avisos da Familia"
  on public.family_announcements for insert to authenticated
  with check ((select public.is_admin()) and created_by = (select auth.uid()));

create policy "Administradores removem avisos da Familia"
  on public.family_announcements for delete to authenticated
  using ((select public.is_admin()));

create table public.family_announcement_reads (
  announcement_id uuid not null references public.family_announcements(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (announcement_id, user_id)
);

create index family_announcement_reads_user_id_idx
  on public.family_announcement_reads (user_id, read_at desc);

alter table public.family_announcement_reads enable row level security;
revoke all on table public.family_announcement_reads from anon;
grant select, insert, update on table public.family_announcement_reads to authenticated;

create policy "Membro consulta as proprias leituras"
  on public.family_announcement_reads for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Membro registra a propria leitura"
  on public.family_announcement_reads for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "Membro atualiza a propria leitura"
  on public.family_announcement_reads for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

comment on table public.family_announcements is
  'Avisos enviados pela administração para todos os membros aprovados da Área da Família.';

comment on table public.family_announcement_reads is
  'Registro individual de leitura dos avisos da Área da Família.';
