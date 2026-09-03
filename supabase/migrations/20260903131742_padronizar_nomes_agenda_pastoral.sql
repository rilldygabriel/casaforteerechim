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
