create table if not exists public.membros (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  phone text,
  instagram text,
  birth_date date,
  jesus_year integer,
  previous_ministry text,
  baptized text,
  photo_url text,
  status_igreja text not null default 'visitante',
  ministerios text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.membros enable row level security;
drop policy if exists "membro le proprio perfil" on public.membros;
create policy "membro le proprio perfil" on public.membros for select to authenticated using (auth.uid() = user_id or public.is_admin());
drop policy if exists "membro cria proprio perfil" on public.membros;
create policy "membro cria proprio perfil" on public.membros for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "membro atualiza proprio perfil" on public.membros;
create policy "membro atualiza proprio perfil" on public.membros for update to authenticated using (auth.uid() = user_id or public.is_admin()) with check (auth.uid() = user_id or public.is_admin());
create index if not exists membros_status_idx on public.membros(status_igreja);
create index if not exists membros_nome_idx on public.membros(full_name);