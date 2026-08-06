DELETE FROM public.rechnungspositionen WHERE rechnung_id IN (SELECT id FROM public.rechnungen WHERE gmail_message_id = 'gm-test-1');
DELETE FROM public.rechnungen WHERE gmail_message_id = 'gm-test-1';
DELETE FROM public.lieferanten WHERE name = 'Testlieferant' AND NOT EXISTS (SELECT 1 FROM public.produkte p WHERE p.lieferant_id = lieferanten.id);