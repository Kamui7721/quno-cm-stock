-- Remove fully permissive anon/authenticated policies; access moves to server-side
-- code (service role) behind a server-verified password gate.
DROP POLICY IF EXISTS "open access kategorien" ON public.kategorien;
DROP POLICY IF EXISTS "open access lieferanten" ON public.lieferanten;
DROP POLICY IF EXISTS "open access produkte" ON public.produkte;
DROP POLICY IF EXISTS "open access rechnungen" ON public.rechnungen;
DROP POLICY IF EXISTS "open access rechnungspositionen" ON public.rechnungspositionen;
DROP POLICY IF EXISTS "open access zaehlungen" ON public.zaehlungen;
DROP POLICY IF EXISTS "open access zaehlungspositionen" ON public.zaehlungspositionen;
DROP POLICY IF EXISTS "open access verkaufszahlen" ON public.verkaufszahlen;

ALTER TABLE public.kategorien ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lieferanten ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produkte ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rechnungen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rechnungspositionen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zaehlungen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zaehlungspositionen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verkaufszahlen ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.kategorien FROM anon, authenticated;
REVOKE ALL ON public.lieferanten FROM anon, authenticated;
REVOKE ALL ON public.produkte FROM anon, authenticated;
REVOKE ALL ON public.rechnungen FROM anon, authenticated;
REVOKE ALL ON public.rechnungspositionen FROM anon, authenticated;
REVOKE ALL ON public.zaehlungen FROM anon, authenticated;
REVOKE ALL ON public.zaehlungspositionen FROM anon, authenticated;
REVOKE ALL ON public.verkaufszahlen FROM anon, authenticated;

GRANT ALL ON public.kategorien TO service_role;
GRANT ALL ON public.lieferanten TO service_role;
GRANT ALL ON public.produkte TO service_role;
GRANT ALL ON public.rechnungen TO service_role;
GRANT ALL ON public.rechnungspositionen TO service_role;
GRANT ALL ON public.zaehlungen TO service_role;
GRANT ALL ON public.zaehlungspositionen TO service_role;
GRANT ALL ON public.verkaufszahlen TO service_role;