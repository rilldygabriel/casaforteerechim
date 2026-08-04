revoke insert, update, delete, truncate, references, trigger
on public.testimonials, public.testimonial_likes, public.testimonial_comments
from anon, authenticated;
