-- Run in the Supabase SQL Editor after the person has signed up and verified
-- their email. Further staff can then be promoted from the HR settings screen.
update public.profiles set role = 'hr_admin' where email = 'you@yourcompany.com';
