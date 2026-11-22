-- Internal paper-ticket ledger. Not a public event or payment-provider record.
create table public.galeto_allocations (
  id uuid primary key,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  allocated integer not null check (allocated between 0 and 10000),
  settled integer not null default 0 check (settled >= 0 and settled <= allocated),
  picked_up integer not null default 0 check (picked_up >= 0 and picked_up <= allocated),
  settlement_reviewed boolean not null default false,
  notes text not null default '' check (char_length(notes) <= 1000),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (settlement_reviewed or settled = 0)
);
create unique index galeto_allocations_name on public.galeto_allocations (lower(btrim(name)));
create table public.galeto_changes (
  id uuid primary key default gen_random_uuid(),
  allocation_id uuid not null references public.galeto_allocations(id),
  actor_id uuid not null,
  before_state jsonb,
  after_state jsonb not null,
  created_at timestamptz not null default now()
);
create index galeto_changes_allocation_time on public.galeto_changes(allocation_id, created_at desc);
create index galeto_changes_time on public.galeto_changes(created_at desc);
alter table public.galeto_allocations enable row level security;
alter table public.galeto_changes enable row level security;
revoke all on public.galeto_allocations, public.galeto_changes from anon, authenticated;
grant select, insert, update on public.galeto_allocations to authenticated;
grant select, insert on public.galeto_changes to authenticated;
create policy galeto_read on public.galeto_allocations for select to authenticated
using ((select auth.uid()) in ('34944370-8853-4c1b-866b-8c80b4e59829'::uuid, '4233f7fd-d931-445d-afab-d775d221a68e'::uuid));
create policy galeto_insert on public.galeto_allocations for insert to authenticated
with check ((select auth.uid()) in ('34944370-8853-4c1b-866b-8c80b4e59829'::uuid, '4233f7fd-d931-445d-afab-d775d221a68e'::uuid));
create policy galeto_update on public.galeto_allocations for update to authenticated
using ((select auth.uid()) in ('34944370-8853-4c1b-866b-8c80b4e59829'::uuid, '4233f7fd-d931-445d-afab-d775d221a68e'::uuid))
with check ((select auth.uid()) in ('34944370-8853-4c1b-866b-8c80b4e59829'::uuid, '4233f7fd-d931-445d-afab-d775d221a68e'::uuid));
create policy galeto_history_read on public.galeto_changes for select to authenticated
using ((select auth.uid()) in ('34944370-8853-4c1b-866b-8c80b4e59829'::uuid, '4233f7fd-d931-445d-afab-d775d221a68e'::uuid));
create policy galeto_history_insert on public.galeto_changes for insert to authenticated
with check (actor_id = (select auth.uid()) and (select auth.uid()) in ('34944370-8853-4c1b-866b-8c80b4e59829'::uuid, '4233f7fd-d931-445d-afab-d775d221a68e'::uuid));

create function public.galeto_record_change() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null or auth.uid() not in ('34944370-8853-4c1b-866b-8c80b4e59829'::uuid, '4233f7fd-d931-445d-afab-d775d221a68e'::uuid) then
    raise exception 'Sem acesso ao controle do galeto.' using errcode = '42501';
  end if;
  if TG_WHEN = 'BEFORE' then
    if TG_OP = 'UPDATE' then
      if new.id <> old.id then raise exception 'Identificação imutável.'; end if;
      new.version := old.version + 1;
      new.created_at := old.created_at;
    else
      new.version := 1;
      new.created_at := now();
    end if;
    new.updated_at := now();
    new.name := btrim(new.name);
  else
    insert into public.galeto_changes(allocation_id, actor_id, before_state, after_state)
    values (new.id, auth.uid(), case when TG_OP = 'UPDATE' then to_jsonb(old) else null end, to_jsonb(new));
  end if;
  return new;
end; $$;
revoke all on function public.galeto_record_change() from public, anon, authenticated;
create trigger galeto_version before insert or update on public.galeto_allocations
for each row execute function public.galeto_record_change();
create trigger galeto_audit after insert or update on public.galeto_allocations
for each row execute function public.galeto_record_change();

-- Optimistic versioning prevents two phones overwriting each other or a retry
-- counting the same pickup twice. All quantities are cumulative, never deltas.
create function public.save_galeto_allocation(p_id uuid, p_version integer, p_name text,
  p_allocated integer, p_settled integer, p_picked_up integer, p_reviewed boolean, p_notes text)
returns public.galeto_allocations
language plpgsql security invoker set search_path = '' as $$
declare result public.galeto_allocations;
begin
  if auth.uid() is null or auth.uid() not in ('34944370-8853-4c1b-866b-8c80b4e59829'::uuid, '4233f7fd-d931-445d-afab-d775d221a68e'::uuid) then
    raise exception 'Sem acesso ao controle do galeto.' using errcode = '42501';
  end if;
  if p_version = 0 then
    insert into public.galeto_allocations(id, name, allocated, settled, picked_up, settlement_reviewed, notes)
    values (p_id, p_name, p_allocated, p_settled, p_picked_up, p_reviewed, p_notes)
    on conflict (id) do nothing returning * into result;
    if result.id is null then
      select * into result from public.galeto_allocations where id = p_id;
    end if;
  else
    update public.galeto_allocations set name = p_name, allocated = p_allocated,
      settled = p_settled, picked_up = p_picked_up, settlement_reviewed = p_reviewed, notes = p_notes
    where id = p_id and version = p_version returning * into result;
    if result.id is null then
      raise exception 'Este registro mudou. Atualize a lista antes de salvar novamente.' using errcode = '40001';
    end if;
  end if;
  return result;
end; $$;
revoke all on function public.save_galeto_allocation(uuid, integer, text, integer, integer, integer, boolean, text) from public, anon;
grant execute on function public.save_galeto_allocation(uuid, integer, text, integer, integer, integer, boolean, text) to authenticated;
