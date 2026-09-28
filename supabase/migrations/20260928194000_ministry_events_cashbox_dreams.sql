-- Separate ministry cashbooks. No changes to payment providers or church finance.
create function public.can_manage_ministry_fund(p_key text) returns boolean
language sql stable security invoker set search_path = '' as $$
  select (select public.is_admin()) or (
    exists(select 1 from public.member_profiles p where p.user_id=(select auth.uid()) and p.approval_status='approved')
    and exists(select 1 from public.ministry_leaders l where l.member_id=(select auth.uid()) and l.ministry_key=p_key)
  );
$$;
revoke all on function public.can_manage_ministry_fund(text) from public, anon;
grant execute on function public.can_manage_ministry_fund(text) to authenticated;

create table public.ministry_fund_events (
  id uuid primary key default gen_random_uuid(),
  ministry_key text not null check(ministry_key in ('louvor','connect_recepcao','connect_consolidacao','casa_kids','midias_fotos','midias_stories','midias_transmissao','projecao','intercessao','cozinha','cafe','mesa_de_som')),
  title text not null check(length(trim(title)) between 3 and 120),
  description text not null default '' check(length(description)<=2000),
  event_date date not null,
  status text not null default 'planned' check(status in ('planned','completed','archived')),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_by uuid not null default auth.uid(),
  updated_at timestamptz not null default now(),
  unique(id,ministry_key)
);
create table public.ministry_fund_dreams (
  id uuid primary key default gen_random_uuid(),
  ministry_key text not null check(ministry_key in ('louvor','connect_recepcao','connect_consolidacao','casa_kids','midias_fotos','midias_stories','midias_transmissao','projecao','intercessao','cozinha','cafe','mesa_de_som')),
  title text not null check(length(trim(title)) between 3 and 120),
  description text not null default '' check(length(description)<=2000),
  target_cents bigint not null check(target_cents between 1 and 999999999),
  status text not null default 'active' check(status in ('active','purchased','archived')),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_by uuid not null default auth.uid(),
  updated_at timestamptz not null default now(),
  unique(id,ministry_key)
);
create table public.ministry_fund_entries (
  id uuid primary key default gen_random_uuid(),
  ministry_key text not null check(ministry_key in ('louvor','connect_recepcao','connect_consolidacao','casa_kids','midias_fotos','midias_stories','midias_transmissao','projecao','intercessao','cozinha','cafe','mesa_de_som')),
  event_id uuid,
  dream_id uuid,
  kind text not null check(kind in ('sale','cash_donation','expense','in_kind','opening_balance','withdrawal')),
  description text not null check(length(trim(description)) between 3 and 500),
  amount_cents bigint not null check(amount_cents between 0 and 999999999),
  quantity integer not null default 0 check(quantity between 0 and 1000000),
  occurred_on date not null,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by uuid,
  void_reason text,
  foreign key(event_id,ministry_key) references public.ministry_fund_events(id,ministry_key),
  foreign key(dream_id,ministry_key) references public.ministry_fund_dreams(id,ministry_key),
  check(kind='in_kind' or amount_cents>0),
  check((kind='sale' and quantity>0 and event_id is not null) or (kind='in_kind') or (kind not in ('sale','in_kind') and quantity=0)),
  check(kind<>'opening_balance' or (event_id is null and dream_id is null)),
  check((voided_at is null and voided_by is null and void_reason is null) or (voided_at is not null and voided_by is not null and length(trim(void_reason)) between 3 and 500))
);
create index ministry_fund_events_key_date on public.ministry_fund_events(ministry_key,event_date desc);
create index ministry_fund_dreams_key on public.ministry_fund_dreams(ministry_key);
create index ministry_fund_entries_key_date on public.ministry_fund_entries(ministry_key,occurred_on desc,created_at desc);
create index ministry_fund_entries_event on public.ministry_fund_entries(event_id,ministry_key);
create index ministry_fund_entries_dream on public.ministry_fund_entries(dream_id,ministry_key);
create unique index ministry_fund_one_opening on public.ministry_fund_entries(ministry_key) where kind='opening_balance' and voided_at is null;

-- Authorship is server-derived, money is append-only, and cancellations retain history.
create function public.guard_ministry_fund_record() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if TG_OP='INSERT' then
    new.created_by:=auth.uid(); new.created_at:=now();
    if TG_TABLE_NAME='ministry_fund_entries' then
      new.voided_at:=null; new.voided_by:=null; new.void_reason:=null;
    else new.updated_by:=auth.uid(); new.updated_at:=now(); end if;
  else
    if new.id<>old.id or new.ministry_key<>old.ministry_key or new.created_by<>old.created_by or new.created_at<>old.created_at then raise exception 'Ownership is immutable'; end if;
    if TG_TABLE_NAME='ministry_fund_entries' then
      if old.voided_at is not null or new.voided_at is null or length(trim(coalesce(new.void_reason,'')))<3 then raise exception 'Cancellation requires a reason'; end if;
      if (to_jsonb(new)-array['voided_at','voided_by','void_reason']) is distinct from (to_jsonb(old)-array['voided_at','voided_by','void_reason']) then raise exception 'Financial entries are immutable'; end if;
      new.voided_by:=auth.uid(); new.voided_at:=now();
    else new.updated_by:=auth.uid(); new.updated_at:=now(); end if;
  end if;
  return new;
end;
$$;
revoke all on function public.guard_ministry_fund_record() from public,anon,authenticated;
do $$ declare t text; begin
  foreach t in array array['ministry_fund_events','ministry_fund_dreams','ministry_fund_entries'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon, authenticated',t);
    execute format('grant select, insert, update on public.%I to authenticated',t);
    execute format('grant all on public.%I to service_role',t);
    execute format('create policy ministry_read on public.%I for select to authenticated using (public.can_manage_ministry_fund(ministry_key))',t);
    execute format('create policy ministry_insert on public.%I for insert to authenticated with check (public.can_manage_ministry_fund(ministry_key) and created_by=(select auth.uid()))',t);
    execute format('create policy ministry_update on public.%I for update to authenticated using (public.can_manage_ministry_fund(ministry_key)) with check (public.can_manage_ministry_fund(ministry_key))',t);
    execute format('create trigger ministry_guard before insert or update on public.%I for each row execute function public.guard_ministry_fund_record()',t);
  end loop;
end $$;

-- Database aggregation avoids the REST 1,000-row limit; caller RLS stays active.
create function public.ministry_fund_totals() returns table (
  ministry_key text, scope text, scope_id uuid, sales_cents bigint,
  donations_cents bigint, expenses_cents bigint, other_in_cents bigint,
  withdrawals_cents bigint, in_kind_cents bigint, units bigint, balance_cents bigint
) language sql stable security invoker set search_path='' as $$
  select e.ministry_key,
    case when grouping(e.event_id)=0 then 'event' when grouping(e.dream_id)=0 then 'dream' else 'ministry' end,
    coalesce(e.event_id,e.dream_id),
    coalesce(sum(e.amount_cents) filter(where e.kind='sale'),0)::bigint,
    coalesce(sum(e.amount_cents) filter(where e.kind='cash_donation'),0)::bigint,
    coalesce(sum(e.amount_cents) filter(where e.kind='expense'),0)::bigint,
    coalesce(sum(e.amount_cents) filter(where e.kind='opening_balance'),0)::bigint,
    coalesce(sum(e.amount_cents) filter(where e.kind='withdrawal'),0)::bigint,
    coalesce(sum(e.amount_cents) filter(where e.kind='in_kind'),0)::bigint,
    coalesce(sum(e.quantity) filter(where e.kind='sale'),0)::bigint,
    coalesce(sum(case when e.kind in ('sale','cash_donation','opening_balance') then e.amount_cents when e.kind in ('expense','withdrawal') then -e.amount_cents else 0 end),0)::bigint
  from public.ministry_fund_entries e where e.voided_at is null
  group by grouping sets ((e.ministry_key),(e.ministry_key,e.event_id),(e.ministry_key,e.dream_id))
  having (grouping(e.event_id)=1 or e.event_id is not null) and (grouping(e.dream_id)=1 or e.dream_id is not null);
$$;
revoke all on function public.ministry_fund_totals() from public,anon;
grant execute on function public.ministry_fund_totals() to authenticated;
