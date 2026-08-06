
CREATE TABLE public.kategorien (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  typ text NOT NULL DEFAULT 'getränk',
  farbe text NOT NULL DEFAULT '#3b82f6'
);
CREATE TABLE public.lieferanten (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kontaktperson text,
  telefon text,
  email text,
  adresse text,
  kundennummer text,
  iban text,
  erstellt_am timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.produkte (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kategorie_id uuid REFERENCES public.kategorien(id) ON DELETE SET NULL,
  lieferant_id uuid REFERENCES public.lieferanten(id) ON DELETE SET NULL,
  einheit text NOT NULL DEFAULT 'stück',
  aktueller_bestand numeric NOT NULL DEFAULT 0,
  erstellt_am timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.rechnungen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rechnungsnummer text NOT NULL,
  lieferant_id uuid REFERENCES public.lieferanten(id) ON DELETE SET NULL,
  datum date NOT NULL DEFAULT current_date,
  gesamtbetrag numeric NOT NULL DEFAULT 0,
  bezahlt boolean NOT NULL DEFAULT false,
  pdf_url text,
  gmail_message_id text UNIQUE,
  erstellt_am timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.rechnungspositionen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rechnung_id uuid NOT NULL REFERENCES public.rechnungen(id) ON DELETE CASCADE,
  produkt_id uuid REFERENCES public.produkte(id) ON DELETE SET NULL,
  kategorie_id uuid REFERENCES public.kategorien(id) ON DELETE SET NULL,
  bezeichnung text NOT NULL,
  menge numeric NOT NULL DEFAULT 0,
  preis numeric NOT NULL DEFAULT 0
);
CREATE TABLE public.zaehlungen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kategorie_id uuid REFERENCES public.kategorien(id) ON DELETE CASCADE,
  datum date NOT NULL DEFAULT current_date,
  monat text NOT NULL DEFAULT to_char(now(), 'YYYY-MM'),
  status text NOT NULL DEFAULT 'offen',
  abgeschlossen_am timestamptz,
  notiz text
);
CREATE TABLE public.zaehlungspositionen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zaehlung_id uuid NOT NULL REFERENCES public.zaehlungen(id) ON DELETE CASCADE,
  produkt_id uuid REFERENCES public.produkte(id) ON DELETE CASCADE,
  ist_bestand numeric NOT NULL DEFAULT 0,
  soll_bestand numeric NOT NULL DEFAULT 0,
  differenz numeric NOT NULL DEFAULT 0,
  differenz_prozent numeric NOT NULL DEFAULT 0
);
CREATE TABLE public.verkaufszahlen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produkt_id uuid REFERENCES public.produkte(id) ON DELETE CASCADE,
  monat text NOT NULL,
  verkaufte_menge numeric NOT NULL DEFAULT 0,
  umsatz numeric NOT NULL DEFAULT 0,
  erstellt_am timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kategorien, public.lieferanten, public.produkte, public.rechnungen, public.rechnungspositionen, public.zaehlungen, public.zaehlungspositionen, public.verkaufszahlen TO anon, authenticated;
GRANT ALL ON public.kategorien, public.lieferanten, public.produkte, public.rechnungen, public.rechnungspositionen, public.zaehlungen, public.zaehlungspositionen, public.verkaufszahlen TO service_role;

ALTER TABLE public.kategorien ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lieferanten ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produkte ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rechnungen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rechnungspositionen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zaehlungen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zaehlungspositionen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verkaufszahlen ENABLE ROW LEVEL SECURITY;

CREATE POLICY "open access kategorien" ON public.kategorien FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "open access lieferanten" ON public.lieferanten FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "open access produkte" ON public.produkte FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "open access rechnungen" ON public.rechnungen FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "open access rechnungspositionen" ON public.rechnungspositionen FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "open access zaehlungen" ON public.zaehlungen FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "open access zaehlungspositionen" ON public.zaehlungspositionen FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "open access verkaufszahlen" ON public.verkaufszahlen FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

INSERT INTO public.kategorien (name, typ, farbe) VALUES
  ('Getränke', 'getränk', '#3b82f6'),
  ('Lebensmittel', 'lebensmittel', '#10b981'),
  ('Spirituosen', 'getränk', '#a855f7');
