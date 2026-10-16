-- Preserve the existing permission key and memberships; update only the visible label.
update public.member_groups
set name = 'Mídias',
    description = 'Acesso automático à biblioteca Pronto para postar da igreja ao salvar esta classificação.'
where key = 'midia';
