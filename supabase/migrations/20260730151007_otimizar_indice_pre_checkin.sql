drop index if exists public.culto_checkins_evento_resposta_idx;
drop index if exists public.culto_checkins_created_at_idx;

create index culto_checkins_evento_criacao_idx
  on public.culto_checkins (event_date desc, created_at desc);
