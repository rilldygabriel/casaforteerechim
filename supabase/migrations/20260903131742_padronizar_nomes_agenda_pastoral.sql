alter table public.pastoral_availability_slots
  drop constraint pastoral_availability_slots_host_name_check;

update public.pastoral_availability_slots
set
  host_name = case host_name
    when 'Pr. Rilldy' then 'Rilldy'
    when 'Pra. Lize' then 'Lisi'
    when 'Pr. Rilldy e Pra. Lize' then 'Rilldy e Lisi'
    else host_name
  end,
  updated_at = now()
where host_name in ('Pr. Rilldy', 'Pra. Lize', 'Pr. Rilldy e Pra. Lize');

alter table public.pastoral_availability_slots
  add constraint pastoral_availability_slots_host_name_check
    check (host_name in ('Rilldy', 'Lisi', 'Rilldy e Lisi'));
