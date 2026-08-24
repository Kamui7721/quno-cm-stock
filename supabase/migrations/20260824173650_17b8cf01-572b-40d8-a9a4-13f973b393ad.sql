REVOKE ALL ON FUNCTION public.produkt_ek_werte(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.produkt_preisdaten_aktualisieren(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.preisdaten_neu_berechnen() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rechnungsposition_preisdaten_trigger() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.produkt_ek_werte(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.produkt_preisdaten_aktualisieren(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.preisdaten_neu_berechnen() TO service_role;
GRANT EXECUTE ON FUNCTION public.rechnungsposition_preisdaten_trigger() TO service_role;