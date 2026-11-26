-- Settlement and meals are based on tickets taken minus tickets returned (production version).
-- Preserve every existing row and the legacy sold field for audit/history.
alter table public.galeto_allocations drop constraint galeto_sold_bounds;
alter table public.galeto_allocations add constraint galeto_sold_bounds
  check (sold is null or sold between 0 and 10000);
alter table public.galeto_allocations drop constraint galeto_returned_bounds;
alter table public.galeto_allocations add constraint galeto_returned_bounds
  check (returned between 0 and allocated
    and settled <= allocated - returned and picked_up <= allocated - returned);
comment on column public.galeto_allocations.sold is 'Legacy count, preserved for history only. Settlement uses allocated - returned - settled.';

create function public.save_galeto_control_v3(p_id uuid, p_version integer, p_name text,
  p_allocated integer, p_settled integer, p_picked_up integer,
  p_returned integer, p_reviewed boolean, p_notes text)
returns public.galeto_allocations
language plpgsql security invoker set search_path = '' as $$
declare result public.galeto_allocations;
begin
  if auth.uid() is null or auth.uid() not in ('34944370-8853-4c1b-866b-8c80b4e59829'::uuid, '4233f7fd-d931-445d-afab-d775d221a68e'::uuid) then
    raise exception 'Sem acesso ao controle do galeto.' using errcode = '42501';
  end if;
  if p_version is null or p_version < 0 then raise exception 'Versão inválida.' using errcode = '23514'; end if;
  if p_version = 0 then
    insert into public.galeto_allocations(id, name, allocated, settled, picked_up, returned, settlement_reviewed, notes)
    values (p_id, p_name, p_allocated, p_settled, p_picked_up, p_returned, p_reviewed, p_notes)
    on conflict (id) do nothing returning * into result;
    if result.id is null then select * into result from public.galeto_allocations where id = p_id; end if;
  else
    update public.galeto_allocations set name = p_name, allocated = p_allocated,
      settled = p_settled, picked_up = p_picked_up, returned = p_returned,
      settlement_reviewed = p_reviewed, notes = p_notes
    where id = p_id and version = p_version returning * into result;
    if result.id is null then
      raise exception 'Este registro mudou. Atualize a lista antes de salvar novamente.' using errcode = '40001';
    end if;
  end if;
  return result;
end; $$;
revoke all on function public.save_galeto_control_v3(uuid, integer, text, integer, integer, integer, integer, boolean, text) from public, anon;
grant execute on function public.save_galeto_control_v3(uuid, integer, text, integer, integer, integer, integer, boolean, text) to authenticated;
