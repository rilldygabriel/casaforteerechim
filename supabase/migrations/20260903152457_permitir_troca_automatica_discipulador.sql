drop policy if exists discipleship_relationships_admin_update
  on public.discipleship_relationships;
create policy discipleship_relationships_admin_update
  on public.discipleship_relationships for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

grant update on public.discipleship_relationships to authenticated;

create function public.assign_or_transfer_disciple(
  p_discipler_id uuid,
  p_disciple_id uuid
)
returns table (relationship_id uuid, transferred boolean)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_admin_id uuid := (select auth.uid());
  v_existing_id uuid;
  v_existing_discipler_id uuid;
  v_relationship_id uuid;
  v_transferred boolean := false;
begin
  if v_admin_id is null or not (select public.is_admin()) then
    raise exception 'acao nao autorizada';
  end if;

  if p_discipler_id = p_disciple_id then
    raise exception 'discipulador e discipulo devem ser pessoas diferentes';
  end if;

  if not exists (
    select 1
    from public.discipler_roles role
    join public.member_profiles profile on profile.user_id = role.member_id
    where role.member_id = p_discipler_id
      and profile.approval_status = 'approved'
  ) then
    raise exception 'discipulador nao autorizado';
  end if;

  if not exists (
    select 1 from public.member_profiles
    where user_id = p_disciple_id and approval_status = 'approved'
  ) then
    raise exception 'discipulo nao autorizado';
  end if;

  select relationship.id, relationship.discipler_id
  into v_existing_id, v_existing_discipler_id
  from public.discipleship_relationships relationship
  where relationship.disciple_id = p_disciple_id
    and relationship.ended_at is null
  for update;

  if v_existing_id is not null and v_existing_discipler_id = p_discipler_id then
    return query select v_existing_id, false;
    return;
  end if;

  if v_existing_id is not null then
    update public.discipleship_relationships
    set ended_at = now(),
        ended_by = v_admin_id,
        end_reason = 'released_by_admin'
    where id = v_existing_id
      and ended_at is null;
    v_transferred := true;
  end if;

  insert into public.discipleship_relationships (
    discipler_id,
    disciple_id,
    assigned_by
  ) values (
    p_discipler_id,
    p_disciple_id,
    v_admin_id
  )
  returning id into v_relationship_id;

  return query select v_relationship_id, v_transferred;
end;
$$;

revoke all on function public.assign_or_transfer_disciple(uuid, uuid)
  from public, anon;
grant execute on function public.assign_or_transfer_disciple(uuid, uuid)
  to authenticated;

create function public.review_discipleship_request(
  p_member_id uuid,
  p_discipler_id uuid,
  p_decision text
)
returns table (relationship_id uuid, transferred boolean)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_admin_id uuid := (select auth.uid());
  v_relationship_id uuid;
  v_transferred boolean := false;
begin
  if v_admin_id is null or not (select public.is_admin()) then
    raise exception 'acao nao autorizada';
  end if;

  if p_decision not in ('approve', 'reject') then
    raise exception 'decisao invalida';
  end if;

  perform 1
  from public.discipleship_requests request
  where request.member_id = p_member_id
    and request.discipler_id = p_discipler_id
    and request.status = 'pending'
  for update;

  if not found then
    raise exception 'solicitacao nao esta mais pendente';
  end if;

  if p_decision = 'approve' then
    select result.relationship_id, result.transferred
    into v_relationship_id, v_transferred
    from public.assign_or_transfer_disciple(p_discipler_id, p_member_id) result;

    update public.member_profiles
    set has_discipler = true
    where user_id = p_member_id;
  end if;

  update public.discipleship_requests
  set status = case when p_decision = 'approve' then 'approved' else 'rejected' end,
      reviewed_by = v_admin_id,
      reviewed_at = now(),
      updated_at = now()
  where member_id = p_member_id
    and discipler_id = p_discipler_id
    and status = 'pending';

  return query select v_relationship_id, v_transferred;
end;
$$;

revoke all on function public.review_discipleship_request(uuid, uuid, text)
  from public, anon;
grant execute on function public.review_discipleship_request(uuid, uuid, text)
  to authenticated;

comment on function public.assign_or_transfer_disciple(uuid, uuid) is
  'Cria ou troca atomicamente o discipulador de um membro, encerrando o vínculo anterior sem apagar o histórico.';
comment on function public.review_discipleship_request(uuid, uuid, text) is
  'Conclui o aceite administrativo e, quando necessário, troca automaticamente o discipulador em uma única transação.';
