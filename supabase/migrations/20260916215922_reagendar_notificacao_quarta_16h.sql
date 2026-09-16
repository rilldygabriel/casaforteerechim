do $$
declare
  quarta_job_id bigint;
begin
  select jobid
  into quarta_job_id
  from cron.job
  where jobname = 'notificacao-push-quarta';

  if quarta_job_id is null then
    raise exception 'Agendamento notificacao-push-quarta não encontrado';
  end if;

  perform cron.alter_job(
    job_id := quarta_job_id,
    schedule := '0 19 * * 3'
  );
end
$$;
