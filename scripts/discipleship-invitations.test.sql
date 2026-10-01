-- Run after the migration inside a transaction; always ROLLBACK.
do $$
declare
  r public.discipleship_relationships%rowtype;
  first_id uuid;
  second_id uuid;
  manual_id uuid;
  result record;
  t timestamptz := now() + interval '60 days';
  saved_count bigint;
begin
  select * into strict r from public.discipleship_relationships where ended_at is null limit 1;
  select count(*) into saved_count from public.discipleship_invitations where relationship_id=r.id and status='accepted';

  -- A disciple/unrelated caller cannot replace a leader's invitations.
  begin
    perform public.save_discipleship_invitation(r.id, r.disciple_id, array[t,t+interval '1 day'], false);
    raise exception 'TEST: unauthorized caller was allowed';
  exception when insufficient_privilege then null;
  end;

  select * into result from public.save_discipleship_invitation(r.id, r.discipler_id, array[t,t+interval '1 day'], false);
  first_id := result.id;
  assert result.created, 'initial invitation not created';
  select * into result from public.save_discipleship_invitation(r.id, r.discipler_id, array[t,t+interval '1 day'], false);
  assert result.id=first_id and not result.created, 'duplicate submit created a new invitation';

  -- Invalid replacement must keep the old invitation available.
  begin
    perform public.save_discipleship_invitation(r.id, r.discipler_id, array[t,t], false);
    raise exception 'TEST: duplicate dates were allowed';
  exception when invalid_parameter_value then null;
  end;
  assert (select status='pending' from public.discipleship_invitations where id=first_id), 'failed replacement cancelled old invitation';

  select * into result from public.save_discipleship_invitation(r.id, r.discipler_id, array[t+interval '2 days',t+interval '3 days'], false);
  second_id := result.id;
  assert result.created and second_id<>first_id, 'pending invitation blocked replacement';
  assert (select status='cancelled' from public.discipleship_invitations where id=first_id), 'old invitation remains actionable';
  assert (select count(*)=2 from public.discipleship_invitation_options where invitation_id=first_id), 'old options deleted';
  assert (select count(*)=1 from public.discipleship_invitations where relationship_id=r.id and status='pending'), 'multiple pending invitations';

  select * into result from public.save_discipleship_invitation(r.id, r.discipler_id, array[t+interval '4 days'], true);
  manual_id := result.id;
  assert result.created, 'manual booking blocked by pending invitation';
  assert (select status='accepted' and accepted_option_id is not null from public.discipleship_invitations where id=manual_id), 'manual booking not accepted';
  assert (select status='cancelled' from public.discipleship_invitations where id=second_id), 'manual did not replace pending';
  select * into result from public.save_discipleship_invitation(r.id, r.discipler_id, array[t+interval '4 days'], true);
  assert result.id=manual_id and not result.created, 'duplicate manual booking';
  assert (select count(*)=saved_count+1 from public.discipleship_invitations where relationship_id=r.id and status='accepted'), 'confirmed bookings changed';
  assert (select count(*)=1 from public.discipleship_conversation_messages where invitation_id=manual_id and message_type='manual_booking'), 'duplicate conversation record';

  assert not has_function_privilege('anon','public.save_discipleship_invitation(uuid,uuid,timestamptz[],boolean)','execute'), 'anonymous RPC exposed';
  assert not has_function_privilege('authenticated','public.save_discipleship_invitation(uuid,uuid,timestamptz[],boolean)','execute'), 'client RPC exposed';
  assert has_function_privilege('service_role','public.save_discipleship_invitation(uuid,uuid,timestamptz[],boolean)','execute'), 'server cannot execute RPC';
end;
$$;
