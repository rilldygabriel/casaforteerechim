-- Replace unanswered invitations atomically; never delete their history.
-- Only the authenticated server action can call this service-role RPC.
create or replace function public.save_discipleship_invitation(
  p_relationship_id uuid,
  p_actor_id uuid,
  p_dates timestamptz[],
  p_manual boolean default false
)
returns table (id uuid, created boolean)
language plpgsql security invoker set search_path = '' as $$
declare
  v_relationship public.discipleship_relationships%rowtype;
  v_existing uuid;
  v_invitation uuid;
  v_option uuid;
  v_request uuid;
  v_dates timestamptz[];
begin
  select * into v_relationship from public.discipleship_relationships
  where discipleship_relationships.id = p_relationship_id and ended_at is null for update;
  if not found or p_actor_id is null or (
    v_relationship.discipler_id <> p_actor_id and not exists (
      select 1 from public.member_profiles where user_id = p_actor_id and is_admin
    )
  ) then
    raise exception 'Sem permissão para agendar neste vínculo.' using errcode = '42501';
  end if;

  if p_manual is null or p_dates is null or cardinality(p_dates) <> (case when p_manual then 1 else 2 end)
    or exists (select 1 from unnest(p_dates) d where d is null or d <= now() or d > now() + interval '120 days')
    or (select count(distinct d) from unnest(p_dates) d) <> cardinality(p_dates) then
    raise exception 'Escolha horários futuros distintos dentro dos próximos 120 dias.' using errcode = '22023';
  end if;
  select array_agg(d order by d) into v_dates from unnest(p_dates) d;

  -- A repeated submit must not create another invitation or another WhatsApp.
  select i.id into v_existing from public.discipleship_invitations i
  where i.relationship_id = p_relationship_id
    and ((not p_manual and i.status = 'pending' and i.invitation_type = 'options')
      or (p_manual and i.status = 'accepted'))
    and (select array_agg(o.starts_at order by o.starts_at)
      from public.discipleship_invitation_options o where o.invitation_id = i.id
      and (not p_manual or o.id = i.accepted_option_id)) = v_dates
  limit 1;
  if v_existing is not null then
    return query select v_existing, false;
    return;
  end if;

  select r.id into v_request from public.discipleship_scheduling_requests r
  where r.relationship_id = p_relationship_id and r.status = 'pending' for update;

  update public.discipleship_invitations i set status = case when i.expires_at <= now() then 'expired' else 'cancelled' end
  where i.relationship_id = p_relationship_id and i.status = 'pending';

  insert into public.discipleship_invitations (relationship_id, request_id, created_by, expires_at, invitation_type)
  values (p_relationship_id, v_request, p_actor_id, v_dates[cardinality(v_dates)], case when p_manual then 'manual' else 'options' end)
  returning discipleship_invitations.id into v_invitation;
  insert into public.discipleship_invitation_options (invitation_id, starts_at, sort_order)
  select v_invitation, d, ord::smallint from unnest(p_dates) with ordinality as dates(d, ord);

  if p_manual then
    select o.id into v_option from public.discipleship_invitation_options o where o.invitation_id = v_invitation;
    update public.discipleship_invitations i
    set status = 'accepted', accepted_option_id = v_option, accepted_at = now() where i.id = v_invitation;
  end if;
  update public.discipleship_scheduling_requests r set status = 'answered', answered_at = now() where r.id = v_request;
  insert into public.discipleship_conversation_messages (relationship_id, sender_id, message_type, invitation_id, scheduled_at)
  values (p_relationship_id, p_actor_id, case when p_manual then 'manual_booking' else 'invitation' end,
    v_invitation, case when p_manual then v_dates[1] else null end);

  return query select v_invitation, true;
end;
$$;
revoke all on function public.save_discipleship_invitation(uuid, uuid, timestamptz[], boolean) from public, anon, authenticated;
grant execute on function public.save_discipleship_invitation(uuid, uuid, timestamptz[], boolean) to service_role;

-- Expired choices must not look like actionable invitations in existing apps.
update public.discipleship_invitations set status = 'expired'
where status = 'pending' and expires_at <= now();
