create index event_tickets_redeemed_by_idx
  on public.event_tickets (redeemed_by)
  where redeemed_by is not null;
