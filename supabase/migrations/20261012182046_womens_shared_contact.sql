-- Separate participants sharing a family contact, without changing the phone
-- uniqueness rule for other legacy events or the ministry checkout flow.
alter table public.event_registrations
  add column contact_participant_key text not null default '';

create function public.event_contact_participant_key(full_name text) returns text
language sql immutable security invoker set search_path = '' as $$
  select lower(btrim(regexp_replace(full_name, '[[:space:]]+', ' ', 'g')));
$$;
revoke all on function public.event_contact_participant_key(text) from public, anon, authenticated;
grant execute on function public.event_contact_participant_key(text) to service_role;

create function public.set_event_contact_participant_key() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  new.contact_participant_key := case when new.ministry_method is null and exists (
    select 1 from public.events where id = new.event_id
      and slug = 'encontro-com-deus-mulheres-2026'
  ) then public.event_contact_participant_key(new.full_name) else '' end;
  return new;
end;
$$;
revoke all on function public.set_event_contact_participant_key() from public, anon, authenticated;
grant execute on function public.set_event_contact_participant_key() to service_role;

update public.event_registrations r
set contact_participant_key = public.event_contact_participant_key(r.full_name)
from public.events e where e.id = r.event_id
  and e.slug = 'encontro-com-deus-mulheres-2026' and r.ministry_method is null;

create trigger set_event_contact_participant_key
before insert or update on public.event_registrations
for each row execute function public.set_event_contact_participant_key();

-- Build the replacement before removing the old rule. The migration is atomic.
create unique index event_registrations_contact_participant_unique
on public.event_registrations (event_id, phone_normalized, contact_participant_key)
where ministry_method is null;
drop index public.event_registrations_legacy_phone_unique;
