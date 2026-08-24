ALTER TABLE public.rechnungen
  ADD COLUMN IF NOT EXISTS summe_netto numeric,
  ADD COLUMN IF NOT EXISTS import_ok boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS import_warnungen text,
  ADD COLUMN IF NOT EXISTS pdf_url text;

ALTER TABLE public.rechnungspositionen
  ADD COLUMN IF NOT EXISTS einzelpreis numeric,
  ADD COLUMN IF NOT EXISTS gebindegroesse numeric;

ALTER TABLE public.rechnungspositionen
  ALTER COLUMN einheit SET DEFAULT 'Stück';

ALTER TABLE public.produkte
  ADD COLUMN IF NOT EXISTS bezeichnung_normalisiert text;

CREATE INDEX IF NOT EXISTS produkte_bezeichnung_normalisiert_idx
  ON public.produkte (bezeichnung_normalisiert);

UPDATE public.produkte
   SET bezeichnung_normalisiert = btrim(regexp_replace(regexp_replace(lower(name), '\s+', ' ', 'g'), '^[^a-z0-9äöüß]+|[^a-z0-9äöüß]+$', '', 'g'))
 WHERE bezeichnung_normalisiert IS NULL;