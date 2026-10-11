begin;
select set_config('request.jwt.claim.sub', (select user_id::text from public.member_profiles where approval_status='approved' and not is_admin order by created_at limit 1), true);
set local role authenticated;
do $test$
declare affected integer;
begin
 if auth.uid() is null then raise exception 'No approved test member found'; end if;
 update public.member_profiles set full_name=full_name, phone=phone, birth_date=birth_date, gender=gender, address=address, church_since_month=church_since_month, jesus_year=jesus_year, attended_other_church=attended_other_church, previous_church_name=previous_church_name, baptized=baptized, married=married, spouse_name=spouse_name, has_discipler=has_discipler, serves_ministry=serves_ministry where user_id=auth.uid();
 get diagnostics affected = row_count;
 if affected <> 1 then raise exception 'Owner update failed: % rows',affected; end if;
 update public.member_profiles set gender=gender where user_id<>auth.uid();
 get diagnostics affected = row_count;
 if affected <> 0 then raise exception 'Cross-member update was allowed'; end if;
 begin
  update public.member_profiles set is_admin=true where user_id=auth.uid();
  raise exception 'Privilege escalation allowed';
 exception when insufficient_privilege then null;
 end;
end $test$;
rollback;
