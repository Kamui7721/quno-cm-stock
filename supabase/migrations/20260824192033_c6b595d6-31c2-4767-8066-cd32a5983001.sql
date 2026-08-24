DROP POLICY IF EXISTS "rechnungen_bucket_deny_clients" ON storage.objects;
CREATE POLICY "rechnungen_bucket_deny_clients"
ON storage.objects
AS RESTRICTIVE
FOR ALL
TO anon, authenticated
USING (bucket_id <> 'rechnungen')
WITH CHECK (bucket_id <> 'rechnungen');