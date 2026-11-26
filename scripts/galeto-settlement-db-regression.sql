-- Synthetic fixtures only. No real member record is changed; audit writes roll back.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','34944370-8853-4c1b-866b-8c80b4e59829',true);
do $$
declare r public.galeto_allocations; fixture uuid := gen_random_uuid(); caught boolean;
begin
  r := public.save_galeto_control_v3(fixture,0,'__TESTE_ACERTO_'||fixture,10,0,0,5,false,'rollback');
  if r.allocated-r.returned-r.settled<>5 or r.sold is not null or r.version<>1 then raise exception '10 taken - 5 returned must owe 5'; end if;
  r := public.save_galeto_control_v3(fixture,0,r.name,10,0,0,5,false,'retry');
  if (select count(*) from public.galeto_changes where allocation_id=fixture)<>1 then raise exception 'duplicate creation'; end if;
  r := public.save_galeto_control_v3(fixture,1,r.name,10,2,4,5,true,'partial settlement');
  if r.allocated-r.returned-r.settled<>3 or r.allocated-r.returned-r.picked_up<>1 then raise exception 'independent balances'; end if;
  caught:=false;
  begin perform public.save_galeto_control_v3(fixture,2,r.name,10,6,4,5,true,'invalid'); exception when check_violation then caught:=true; end;
  if not caught then raise exception 'settled exceeds retained'; end if;
  caught:=false;
  begin perform public.save_galeto_control_v3(fixture,2,r.name,10,2,6,5,true,'invalid'); exception when check_violation then caught:=true; end;
  if not caught then raise exception 'meals exceed retained'; end if;
  caught:=false;
  begin perform public.save_galeto_control_v3(fixture,2,r.name,10,2,4,-1,true,'invalid'); exception when check_violation then caught:=true; end;
  if not caught then raise exception 'negative returned accepted'; end if;
  caught:=false;
  begin perform public.save_galeto_control_v3(fixture,2,r.name,10,2,4,null,true,'invalid'); exception when not_null_violation then caught:=true; end;
  if not caught then raise exception 'null returned accepted'; end if;
  caught:=false;
  begin perform public.save_galeto_control_v3(fixture,2,r.name,10,2,4,5,false,'invalid'); exception when check_violation then caught:=true; end;
  if not caught then raise exception 'unreviewed payment accepted'; end if;
  -- A legacy sold value must neither be overwritten nor constrain the new ledger.
  update public.galeto_allocations set sold=10 where id=fixture returning * into r;
  perform set_config('request.jwt.claim.sub','4233f7fd-d931-445d-afab-d775d221a68e',true);
  r := public.save_galeto_control_v3(fixture,r.version,r.name,8,2,4,4,true,'Lisi correction');
  if r.sold<>10 or r.allocated<>8 or r.returned<>4 or r.settled<>2 or r.picked_up<>4 then raise exception 'legacy preservation/correction failed'; end if;
  if not exists(select 1 from public.galeto_changes where allocation_id=fixture and actor_id=auth.uid() and (before_state->>'returned')::int=5 and (after_state->>'returned')::int=4) then raise exception 'audit missing'; end if;
  caught:=false;
  begin perform public.save_galeto_control_v3(fixture,r.version-1,r.name,8,2,4,4,true,'stale'); exception when serialization_failure then caught:=true; end;
  if not caught then raise exception 'stale overwrite'; end if;
  r := public.save_galeto_control_v3(fixture,r.version,r.name,8,0,0,8,true,'all returned');
  if r.allocated-r.returned<>0 then raise exception 'full return'; end if;
  perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000099',true);
  if exists(select 1 from public.galeto_allocations) or exists(select 1 from public.galeto_changes) then raise exception 'unauthorized read'; end if;
  caught:=false;
  begin perform public.save_galeto_control_v3(fixture,r.version,r.name,8,0,0,8,true,'forbidden'); exception when insufficient_privilege then caught:=true; end;
  if not caught then raise exception 'unauthorized write'; end if;
  if has_function_privilege('anon','public.save_galeto_control_v3(uuid,integer,text,integer,integer,integer,integer,boolean,text)','execute') then raise exception 'anonymous execution granted'; end if;
end $$;
rollback;
select 'PASS: ticket-based settlement, independent meals, corrections, legacy data, audit, both managers, concurrency and private access' as result;
