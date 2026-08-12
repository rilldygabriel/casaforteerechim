-- Agendamento de discipulados. As observacoes pastorais permanecem somente em
-- discipleship_sessions e nunca sao copiadas para estas tabelas.

create table public.discipleship_scheduling_requests (
  id uuid primary key default gen_random_uuid(),
  relationship_id uuid not null references public.discipleship_relationships(id) on delete cascade,
  requested_by uuid not null references public.member_profiles(user_id) on delete restrict,
  status text not null default 'pending' check (status in ('pending', 'answered', 'cancelled')),
  created_at timestamptz not null default now(),
  answered_at timestamptz
);

create table public.discipleship_invitations (
  id uuid primary key default gen_random_uuid(),
  relationship_id uuid not null references public.discipleship_relationships(id) on delete cascade,
  request_id uuid references public.discipleship_scheduling_requests(id) on delete set null,
  created_by uuid not null references public.member_profiles(user_id) on delete restrict,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'cancelled', 'expired')),
  accepted_option_id uuid,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  constraint discipleship_invitations_acceptance_check check (
    (status = 'accepted' and accepted_option_id is not null and accepted_at is not null)
    or (status <> 'accepted' and accepted_option_id is null and accepted_at is null)
  )
);

create table public.discipleship_invitation_options (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.discipleship_invitations(id) on delete cascade,
  starts_at timestamptz not null,
  sort_order smallint not null check (sort_order between 1 and 3),
  created_at timestamptz not null default now(),
  unique (invitation_id, sort_order),
  unique (invitation_id, starts_at)
);

alter table public.discipleship_invitations
  add constraint discipleship_invitations_accepted_option_fk
  foreign key (accepted_option_id) references public.discipleship_invitation_options(id) on delete restrict;

create function public.validate_discipleship_accepted_option()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
begin
  if new.accepted_option_id is not null and not exists (
    select 1 from public.discipleship_invitation_options
    where id = new.accepted_option_id and invitation_id = new.id
  ) then
    raise exception 'A opcao escolhida nao pertence a este convite';
  end if;
  return new;
end; $$;

create trigger validate_discipleship_accepted_option
before update of accepted_option_id on public.discipleship_invitations
for each row execute function public.validate_discipleship_accepted_option();

create table public.discipleship_whatsapp_deliveries (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.discipleship_invitations(id) on delete cascade,
  recipient_id uuid not null references public.member_profiles(user_id) on delete cascade,
  delivery_type text not null check (delivery_type in ('invitation', 'confirmation', 'one_day', 'two_hours')),
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  provider_message_id text,
  error_message text,
  attempted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (invitation_id, recipient_id, delivery_type)
);

create unique index discipleship_scheduling_requests_one_pending_idx
  on public.discipleship_scheduling_requests (relationship_id) where status = 'pending';
create unique index discipleship_invitations_one_pending_idx
  on public.discipleship_invitations (relationship_id) where status = 'pending';
create index discipleship_invitations_relationship_idx
  on public.discipleship_invitations (relationship_id, created_at desc);
create index discipleship_options_starts_at_idx
  on public.discipleship_invitation_options (starts_at) include (invitation_id);
create index discipleship_deliveries_pending_idx
  on public.discipleship_whatsapp_deliveries (delivery_type, status, invitation_id);

alter table public.discipleship_scheduling_requests enable row level security;
alter table public.discipleship_invitations enable row level security;
alter table public.discipleship_invitation_options enable row level security;
alter table public.discipleship_whatsapp_deliveries enable row level security;

-- Toda leitura/escrita passa por Server Actions autenticadas, que filtram o
-- relacionamento antes de usar a chave de servico. Nenhuma tabela fica exposta
-- diretamente ao navegador.
revoke all on public.discipleship_scheduling_requests from anon, authenticated;
revoke all on public.discipleship_invitations from anon, authenticated;
revoke all on public.discipleship_invitation_options from anon, authenticated;
revoke all on public.discipleship_whatsapp_deliveries from anon, authenticated;

comment on table public.discipleship_scheduling_requests is 'Pedidos do discipulo por um novo encontro, sem anotacoes pastorais.';
comment on table public.discipleship_invitations is 'Convites de discipulado enviados com tres opcoes de horario.';
comment on table public.discipleship_invitation_options is 'Tres datas e horarios oferecidos em cada convite.';
comment on table public.discipleship_whatsapp_deliveries is 'Auditoria e idempotencia das confirmacoes e lembretes via WhatsApp.';
