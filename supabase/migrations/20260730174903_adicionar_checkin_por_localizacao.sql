alter table public.culto_checkins
  add column if not exists checkin_origem text not null default 'manual',
  add column if not exists localizacao_distancia_m integer,
  add column if not exists localizacao_precisao_m integer;

alter table public.culto_checkins
  drop constraint if exists culto_checkins_origem_check,
  drop constraint if exists culto_checkins_localizacao_distancia_check,
  drop constraint if exists culto_checkins_localizacao_precisao_check;

alter table public.culto_checkins
  add constraint culto_checkins_origem_check
    check (checkin_origem in ('manual', 'localizacao')),
  add constraint culto_checkins_localizacao_distancia_check
    check (
      localizacao_distancia_m is null
      or localizacao_distancia_m between 0 and 10000
    ),
  add constraint culto_checkins_localizacao_precisao_check
    check (
      localizacao_precisao_m is null
      or localizacao_precisao_m between 0 and 5000
    );

comment on column public.culto_checkins.checkin_origem is
  'Origem do registro de presença: painel ou geolocalização consentida.';
comment on column public.culto_checkins.localizacao_distancia_m is
  'Distância aproximada até a igreja; coordenadas exatas não são armazenadas.';
