-- NULL preserves existing church-wide notices. An empty array is private to its author.
alter table public.family_announcements add column recipient_user_ids uuid[];
create policy "Restrict targeted announcements" on public.family_announcements
as restrictive for select to authenticated
using (recipient_user_ids is null or (select auth.uid()) = created_by or (select auth.uid()) = any(recipient_user_ids));

create policy "Restrict targeted announcement comments" on public.family_announcement_comments
as restrictive for all to authenticated
using (exists(select 1 from public.family_announcements a where a.id = announcement_id))
with check (exists(select 1 from public.family_announcements a where a.id = announcement_id));
create policy "Restrict targeted announcement likes" on public.family_announcement_likes
as restrictive for all to authenticated
using (exists(select 1 from public.family_announcements a where a.id = announcement_id))
with check (exists(select 1 from public.family_announcements a where a.id = announcement_id));

-- A claim is never retried automatically after an ambiguous provider result.
create table public.event_notice_deliveries (
 id bigint generated always as identity primary key,
 announcement_id uuid not null references public.family_announcements(id),
 channel text not null check(channel in ('whatsapp','push')),
 recipient text not null,
 part integer not null default 0,
 status text not null default 'reserved' check(status in ('reserved','accepted','failed','unknown')),
 provider_message_id text,
 error_message text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(announcement_id,channel,recipient,part)
);
alter table public.event_notice_deliveries enable row level security;
revoke all on public.event_notice_deliveries from anon, authenticated;
grant select,insert,update on public.event_notice_deliveries to service_role;
grant usage,select on sequence public.event_notice_deliveries_id_seq to service_role;
