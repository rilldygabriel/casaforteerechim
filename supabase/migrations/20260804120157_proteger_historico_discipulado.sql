alter table public.discipleship_relationships
  drop constraint if exists discipleship_relationships_discipler_id_fkey,
  add constraint discipleship_relationships_discipler_id_fkey
    foreign key (discipler_id) references public.discipler_roles(member_id) on delete restrict;

alter table public.discipleship_sessions
  drop constraint if exists discipleship_sessions_relationship_id_fkey,
  add constraint discipleship_sessions_relationship_id_fkey
    foreign key (relationship_id) references public.discipleship_relationships(id) on delete restrict;
