-- Synthetic fixtures only; all writes and audit entries roll back.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','34944370-8853-4c1b-866b-8c80b4e59829',true);
do $$
declare r public.galeto_allocations; fixture uuid := gen_random_uuid(); caught boolean;
begin
  r := public.save_galeto_counts_v2(fixture,0,'__TESTE_DEVOLUCAO_'||fixture,10,6,4,2,3,true,'rollback');
  if r.returned<>3 or r.sold<>6 or r.settled<>4 or r.picked_up<>2 or r.version<>1 then raise exception 'counts mismatch'; end if;
  r := public.save_galeto_counts_v2(fixture,0,r.name,10,6,4,2,3,true,'retry');
  if (select count(*) from public.galeto_changes where allocation_id=fixture)<>1 then raise exception 'duplicate creation'; end if;
  caught:=false;
  begin perform public.save_galeto_counts_v2(fixture,1,r.name,10,6,4,2,7,true,'invalid'); exception when check_violation then caught:=true; end;
  if not caught then raise exception 'settled + returned exceeds allocated'; end if;
  caught:=false;
  begin perform public.save_galeto_counts_v2(fixture,1,r.name,10,6,4,2,-1,true,'invalid'); exception when check_violation then caught:=true; end;
  if not caught then raise exception 'negative returned accepted'; end if;
  caught:=false;
  begin perform public.save_galeto_counts_v2(fixture,1,r.name,10,6,4,2,null,true,'invalid'); exception when not_null_violation then caught:=true; end;
  if not caught then raise exception 'null returned accepted'; end if;
  -- Already-open old UI must preserve returned and respect the new constraint.
  r := public.save_galeto_counts(fixture,1,r.name,10,7,4,2,true,'old UI');
  if r.returned<>3 then raise exception 'old RPC overwrote returned'; end if;
  caught:=false;
  begin perform public.save_galeto_counts(fixture,2,r.name,10,8,8,2,true,'old UI invalid'); exception when check_violation then caught:=true; end;
  if not caught then raise exception 'old RPC bypassed constraint'; end if;
  perform set_config('request.jwt.claim.sub','4233f7fd-d931-445d-afab-d775d221a68e',true);
  r := public.save_galeto_counts_v2(fixture,2,r.name,10,7,4,2,2,true,'Lisi correction');
  if r.returned<>2 or r.version<>3 or r.settled<>4 or r.picked_up<>2 then raise exception 'Lisi correction failed'; end if;
  if not exists(select 1 from public.galeto_changes where allocation_id=fixture and (before_state->>'returned')::int=3 and (after_state->>'returned')::int=2) then raise exception 'audit missing returned'; end if;
  caught:=false;
  begin perform public.save_galeto_counts_v2(fixture,2,r.name,10,7,4,2,1,true,'stale'); exception when serialization_failure then caught:=true; end;
  if not caught then raise exception 'stale overwrite'; end if;
  perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000099',true);
  if exists(select 1 from public.galeto_allocations) then raise exception 'unauthorized read'; end if;
  caught:=false;
  begin perform public.save_galeto_counts_v2(fixture,3,r.name,10,7,4,2,1,true,'forbidden'); exception when insufficient_privilege then caught:=true; end;
  if not caught then raise exception 'unauthorized write'; end if;
end $$;
rollback;
select 'PASS: returned counts, both managers, audit, retries, legacy RPC, concurrency and access' as result;
