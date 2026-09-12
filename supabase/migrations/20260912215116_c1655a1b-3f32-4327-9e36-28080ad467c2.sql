CREATE TABLE public.design_partner_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_email text NOT NULL CHECK (char_length(work_email) BETWEEN 3 AND 254),
  company text NOT NULL CHECK (char_length(company) BETWEEN 1 AND 120),
  providers text NOT NULL CHECK (char_length(providers) BETWEEN 1 AND 500),
  current_breakage text CHECK (current_breakage IS NULL OR char_length(current_breakage) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.design_partner_applications TO anon;
GRANT INSERT ON public.design_partner_applications TO authenticated;
GRANT ALL ON public.design_partner_applications TO service_role;

ALTER TABLE public.design_partner_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a design partner application"
ON public.design_partner_applications
FOR INSERT
TO anon, authenticated
WITH CHECK (
  work_email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
  AND char_length(btrim(company)) BETWEEN 1 AND 120
  AND char_length(btrim(providers)) BETWEEN 1 AND 500
  AND (current_breakage IS NULL OR char_length(current_breakage) <= 2000)
);