create table public.assistant_knowledge (
  id bigint generated always as identity primary key,
  question text not null check (char_length(trim(question)) between 5 and 240),
  answer text not null check (char_length(trim(answer)) between 5 and 4000),
  source_url text check (source_url is null or char_length(source_url) <= 500),
  published boolean not null default false,
  sort_order integer not null default 0,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index assistant_knowledge_published_idx
  on public.assistant_knowledge (sort_order, updated_at desc)
  where published = true;

create index assistant_knowledge_updated_by_idx
  on public.assistant_knowledge (updated_by)
  where updated_by is not null;

alter table public.assistant_knowledge enable row level security;

create policy "Administradores consultam a base da IA"
  on public.assistant_knowledge for select to authenticated
  using ((select public.is_admin()));

create policy "Administradores cadastram conhecimento da IA"
  on public.assistant_knowledge for insert to authenticated
  with check ((select public.is_admin()) and updated_by = (select auth.uid()));

create policy "Administradores atualizam conhecimento da IA"
  on public.assistant_knowledge for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()) and updated_by = (select auth.uid()));

grant select, insert, update on public.assistant_knowledge to authenticated;
grant all on public.assistant_knowledge to service_role;
grant usage, select on sequence public.assistant_knowledge_id_seq to authenticated, service_role;

create table public.assistant_generations (
  id bigint generated always as identity primary key,
  client_key text not null check (char_length(client_key) = 64),
  question text not null check (char_length(question) between 1 and 1200),
  answer text,
  model text not null,
  usage jsonb,
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed')),
  error_code text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index assistant_generations_rate_idx
  on public.assistant_generations (client_key, created_at desc);

alter table public.assistant_generations enable row level security;

create policy "Administradores consultam respostas da IA"
  on public.assistant_generations for select to authenticated
  using ((select public.is_admin()));

grant select on public.assistant_generations to authenticated;
grant all on public.assistant_generations to service_role;
grant usage, select on sequence public.assistant_generations_id_seq to service_role;

insert into public.assistant_knowledge (question, answer, source_url, published, sort_order) values
  ('Onde fica a Igreja Casa Forte Erechim?', 'A Casa Forte fica na Rua José Reinaldo Angonezze, 319, em Erechim, RS. Você pode abrir o mapa em https://maps.app.goo.gl/wAtHfmS7cFcFP5UC9?g_st=ic.', '/', true, 1),
  ('Como vejo a programação de cultos e eventos?', 'Confira as datas e horários atualizados no calendário da Casa: https://www.casaforteerechim.app.br/calendario. Para eventos com inscrição, acesse https://www.casaforteerechim.app.br/eventos.', '/calendario', true, 2),
  ('Como faço um pedido de oração?', 'Você pode enviar seu pedido pela página https://www.casaforteerechim.app.br/oracao. A equipe da Casa o recebe com cuidado.', '/oracao', true, 3);
