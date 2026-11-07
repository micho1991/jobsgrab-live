-- Sample job positions for local development (`supabase db reset` runs this).
insert into public.positions (title, department, location, employment_type, description, application_deadline, status, is_active) values
  ('Senior Frontend Engineer', 'Engineering', 'Remote (EU)', 'full_time',
   'Build and own our customer-facing web applications with React and TypeScript.', current_date + 45, 'open', true),
  ('HR Generalist', 'People', 'Skopje, North Macedonia', 'full_time',
   'Support recruitment, onboarding and employee relations across the company.', current_date + 30, 'open', true),
  ('Customer Success Manager', 'Customer Success', 'Hybrid, Ohrid', 'full_time',
   'Guide our clients from onboarding to renewal and be their advocate internally.', null, 'open', true),
  ('Marketing Intern', 'Marketing', 'Remote', 'internship',
   'A 6-month paid internship supporting campaigns, content and analytics.', current_date + 14, 'open', true),
  ('Finance Analyst', 'Finance', 'Skopje, North Macedonia', 'full_time',
   'Position filled; kept for reporting.', current_date - 10, 'closed', false);
