ALTER TABLE public.rechnungen
  ADD COLUMN IF NOT EXISTS geprueft boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS geprueft_am timestamp with time zone,
  ADD COLUMN IF NOT EXISTS geprueft_von text;