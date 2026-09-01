INSERT INTO public.kategorien (name, typ, farbe)
SELECT 'Sonstiges', 'sonstiges', '#64748b'
WHERE NOT EXISTS (SELECT 1 FROM public.kategorien WHERE lower(name) = 'sonstiges');