create policy "Entregas push sem acesso pelo cliente"
  on public.web_push_deliveries
  for all
  to anon, authenticated
  using (false)
  with check (false);
