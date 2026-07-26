-- Cadastro automático da Área da Família.
-- As solicitações passam exclusivamente pela Edge Function protegida por OIDC.

alter table public.member_applications
  add column if not exists request_fingerprint text;

create index if not exists member_applications_fingerprint_created_idx
  on public.member_applications (request_fingerprint, created_at desc)
  where request_fingerprint is not null;

drop policy if exists member_applications_public_insert
  on public.member_applications;

revoke insert on public.member_applications from anon;
revoke usage, select
  on sequence public.member_applications_id_seq
  from anon;

comment on table public.member_applications is
  'Cadastros automáticos da Área da Família. O acesso público direto foi removido e nenhum papel público recebe DELETE.';

comment on column public.member_applications.status is
  'pending: processamento ou falha de envio; invited: convite enviado; rejected: acesso bloqueado pela liderança.';

comment on column public.member_applications.request_fingerprint is
  'Hash técnico usado exclusivamente para limitar abuso no cadastro automático.';
