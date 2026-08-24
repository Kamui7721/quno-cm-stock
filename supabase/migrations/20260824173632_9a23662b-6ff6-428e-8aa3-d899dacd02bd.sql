-- 1. Rechnungspositionen: Einzelpreis + Einheit
ALTER TABLE public.rechnungspositionen
  ADD COLUMN IF NOT EXISTS einzelpreis numeric,
  ADD COLUMN IF NOT EXISTS einheit text;

UPDATE public.rechnungspositionen
SET einzelpreis = CASE WHEN menge <> 0 THEN preis / menge ELSE NULL END
WHERE einzelpreis IS NULL;

-- 2. Produkte: Preisfelder
ALTER TABLE public.produkte
  ADD COLUMN IF NOT EXISTS letzter_ek numeric,
  ADD COLUMN IF NOT EXISTS letzter_ek_datum date,
  ADD COLUMN IF NOT EXISTS durchschnitt_ek numeric;

-- 3. Einstellungen (Key/Value)
CREATE TABLE IF NOT EXISTS public.einstellungen (
  schluessel text PRIMARY KEY,
  wert text NOT NULL,
  erstellt_am timestamptz NOT NULL DEFAULT now(),
  aktualisiert_am timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.einstellungen TO service_role;
ALTER TABLE public.einstellungen ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_full_access ON public.einstellungen;
CREATE POLICY service_role_full_access ON public.einstellungen
  FOR ALL TO service_role USING (true) WITH CHECK (true);

INSERT INTO public.einstellungen (schluessel, wert)
VALUES ('preisalarm_schwelle', '10')
ON CONFLICT (schluessel) DO NOTHING;

-- 4. Hilfsfunktion: Einkaufswerte eines Produkts
CREATE OR REPLACE FUNCTION public.produkt_ek_werte(p_produkt_id uuid)
RETURNS TABLE (ep numeric, ek_datum date)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(rp.einzelpreis, CASE WHEN rp.menge <> 0 THEN rp.preis / rp.menge END) AS ep,
         r.datum AS ek_datum
  FROM public.rechnungspositionen rp
  JOIN public.rechnungen r ON r.id = rp.rechnung_id
  WHERE rp.produkt_id = p_produkt_id
$$;

-- 5. Preisdaten eines Produkts neu berechnen
CREATE OR REPLACE FUNCTION public.produkt_preisdaten_aktualisieren(p_produkt_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_median numeric;
  v_avg numeric;
  v_last numeric;
  v_last_datum date;
BEGIN
  IF p_produkt_id IS NULL THEN
    RETURN;
  END IF;

  SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY ep)
    INTO v_median
    FROM public.produkt_ek_werte(p_produkt_id)
   WHERE ep IS NOT NULL AND ep > 0;

  SELECT ep, ek_datum
    INTO v_last, v_last_datum
    FROM public.produkt_ek_werte(p_produkt_id)
   WHERE ep IS NOT NULL AND ep > 0
   ORDER BY ek_datum DESC NULLS LAST
   LIMIT 1;

  SELECT avg(ep)
    INTO v_avg
    FROM public.produkt_ek_werte(p_produkt_id)
   WHERE ep IS NOT NULL
     AND ep > 0
     AND ek_datum >= (CURRENT_DATE - INTERVAL '12 months')
     AND (v_median IS NULL OR (ep <= v_median * 10 AND ep >= v_median / 10));

  UPDATE public.produkte
     SET letzter_ek = v_last,
         letzter_ek_datum = v_last_datum,
         durchschnitt_ek = v_avg
   WHERE id = p_produkt_id;
END;
$$;

-- 6. Alle Produkte neu berechnen
CREATE OR REPLACE FUNCTION public.preisdaten_neu_berechnen()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_count integer := 0;
BEGIN
  FOR v_id IN SELECT id FROM public.produkte LOOP
    PERFORM public.produkt_preisdaten_aktualisieren(v_id);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

-- 7. Trigger auf Rechnungspositionen
CREATE OR REPLACE FUNCTION public.rechnungsposition_preisdaten_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.produkt_id IS NOT NULL THEN
    PERFORM public.produkt_preisdaten_aktualisieren(NEW.produkt_id);
  END IF;
  IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.produkt_id IS NOT NULL
     AND (TG_OP = 'DELETE' OR OLD.produkt_id IS DISTINCT FROM NEW.produkt_id) THEN
    PERFORM public.produkt_preisdaten_aktualisieren(OLD.produkt_id);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_rechnungsposition_preisdaten ON public.rechnungspositionen;
CREATE TRIGGER trg_rechnungsposition_preisdaten
AFTER INSERT OR UPDATE OR DELETE ON public.rechnungspositionen
FOR EACH ROW EXECUTE FUNCTION public.rechnungsposition_preisdaten_trigger();

-- 8. Einmalige Initialberechnung
SELECT public.preisdaten_neu_berechnen();