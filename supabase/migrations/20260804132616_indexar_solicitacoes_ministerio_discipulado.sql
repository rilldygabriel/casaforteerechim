create index discipleship_requests_discipler_id_idx on public.discipleship_requests (discipler_id);
create index discipleship_requests_reviewed_by_idx on public.discipleship_requests (reviewed_by) where reviewed_by is not null;
create index ministry_membership_requests_ministry_key_idx on public.ministry_membership_requests (ministry_key);
create index ministry_membership_requests_reviewed_by_idx on public.ministry_membership_requests (reviewed_by) where reviewed_by is not null;
