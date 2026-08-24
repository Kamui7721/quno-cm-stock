CREATE TABLE public.lieferant_kategorien (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lieferant_id uuid NOT NULL REFERENCES public.lieferanten(id) ON DELETE CASCADE,
  kategorie text NOT NULL,
  erstellt_am timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (lieferant_id, kategorie)
);

GRANT ALL ON public.lieferant_kategorien TO service_role;
REVOKE ALL ON public.lieferant_kategorien FROM anon, authenticated;

ALTER TABLE public.lieferant_kategorien ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access" ON public.lieferant_kategorien
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX lieferant_kategorien_lieferant_id_idx ON public.lieferant_kategorien(lieferant_id);