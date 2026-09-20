create table public.news_post_reads (
  news_id uuid not null references public.news_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (news_id, user_id)
);

create index news_post_reads_user_id_idx
  on public.news_post_reads (user_id, read_at desc);

alter table public.news_post_reads enable row level security;

revoke all on table public.news_post_reads from anon, authenticated;
grant select, insert, update on table public.news_post_reads to authenticated;
grant all on table public.news_post_reads to service_role;

create policy "Membro consulta as proprias leituras de noticias"
  on public.news_post_reads
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Membro registra a propria leitura de noticia"
  on public.news_post_reads
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Membro atualiza a propria leitura de noticia"
  on public.news_post_reads
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

comment on table public.news_post_reads is
  'Registro individual de leitura das noticias publicadas para compor a central de notificacoes.';
