-- Correção única para login administrativo e gestão de funções dos membros.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.member_profiles
    where user_id = auth.uid()
      and is_admin = true
  );
$$;

grant execute on function public.is_admin() to authenticated;

alter table public.member_profiles enable row level security;

drop policy if exists "Membro vê próprio perfil" on public.member_profiles;
create policy "Membro vê próprio perfil"
on public.member_profiles
for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "Membro cria próprio perfil" on public.member_profiles;
create policy "Membro cria próprio perfil"
on public.member_profiles
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Membro edita próprio perfil" on public.member_profiles;
create policy "Membro edita próprio perfil"
on public.member_profiles
for update
to authenticated
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

create or replace function public.admin_update_member_profile(
  p_user_id uuid,
  p_church_role text,
  p_ministries text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Acesso administrativo não autorizado';
  end if;

  update public.member_profiles
  set church_role = lower(trim(p_church_role)),
      ministries = coalesce(p_ministries, '{}'),
      updated_at = now()
  where user_id = p_user_id;

  if not found then
    raise exception 'Perfil do membro não encontrado';
  end if;
end;
$$;

grant execute on function public.admin_update_member_profile(uuid, text, text[]) to authenticated;
