create policy discipleship_scheduling_requests_server_only
  on public.discipleship_scheduling_requests for all to authenticated
  using (false) with check (false);
create policy discipleship_invitations_server_only
  on public.discipleship_invitations for all to authenticated
  using (false) with check (false);
create policy discipleship_invitation_options_server_only
  on public.discipleship_invitation_options for all to authenticated
  using (false) with check (false);
create policy discipleship_whatsapp_deliveries_server_only
  on public.discipleship_whatsapp_deliveries for all to authenticated
  using (false) with check (false);

create index discipleship_scheduling_requests_requested_by_idx
  on public.discipleship_scheduling_requests (requested_by);
create index discipleship_invitations_request_id_idx
  on public.discipleship_invitations (request_id) where request_id is not null;
create index discipleship_invitations_created_by_idx
  on public.discipleship_invitations (created_by);
create index discipleship_invitations_accepted_option_idx
  on public.discipleship_invitations (accepted_option_id) where accepted_option_id is not null;
create index discipleship_whatsapp_deliveries_recipient_idx
  on public.discipleship_whatsapp_deliveries (recipient_id);
