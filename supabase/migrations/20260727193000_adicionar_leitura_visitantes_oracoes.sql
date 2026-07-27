alter table public.visitantes
  add column if not exists opened_at timestamptz;

alter table public.pedidos_oracao
  add column if not exists opened_at timestamptz;

create index if not exists visitantes_nao_abertos_created_at_idx
  on public.visitantes (created_at desc)
  where opened_at is null;

create index if not exists pedidos_oracao_nao_abertos_created_at_idx
  on public.pedidos_oracao (created_at desc)
  where opened_at is null;

alter policy "visitantes_anon_insert"
  on public.visitantes
  with check (
    length(btrim(nome)) >= 3
    and length(btrim(telefone)) >= 8
    and length(btrim(cidade)) >= 2
    and length(btrim(bairro)) >= 2
    and opened_at is null
  );

alter policy "pedidos_oracao_anon_insert"
  on public.pedidos_oracao
  with check (
    length(btrim(nome)) >= 3
    and length(btrim(telefone)) >= 8
    and length(btrim(pedido)) between 5 and 5000
    and opened_at is null
  );

comment on column public.visitantes.opened_at is
  'Data da primeira abertura da ficha por um administrador.';

comment on column public.pedidos_oracao.opened_at is
  'Data da primeira abertura do pedido por um administrador.';
