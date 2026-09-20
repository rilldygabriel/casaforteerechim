insert into public.event_admin_members (event_id, user_id)
select event.id, profile.user_id
from public.events event
join public.member_profiles profile
  on lower(profile.email) in (
    'sarah_prestes@outlook.com',
    'daianelp2024@gmail.com'
  )
where event.slug = 'hamburguer-da-casa-20-09'
  and event.archived_at is null
  and profile.approval_status = 'approved'
on conflict (event_id, user_id) do nothing;
