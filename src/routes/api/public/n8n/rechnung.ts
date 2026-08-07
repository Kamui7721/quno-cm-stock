import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const API_TOKEN = "quno-cm-2026";

const schema = z.object({
  rechnungsnummer: z.string().trim().min(1).max(200),
  lieferant_name: z.string().trim().min(1).max(200),
  lieferant_kontaktperson: z.string().trim().max(200).optional().nullable(),
  lieferant_telefon: z.string().trim().max(100).optional().nullable(),
  lieferant_email: z.string().trim().max(200).optional().nullable(),
  lieferant_adresse: z.string().trim().max(500).optional().nullable(),
  lieferant_kundennummer: z.string().trim().max(100).optional().nullable(),
  lieferant_iban: z.string().trim().max(100).optional().nullable(),
  datum: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  gesamtbetrag: z.number().finite().min(0),
  pdf_url: z.string().trim().max(2000).optional().nullable(),
  gmail_message_id: z.string().trim().min(1).max(200),
  positionen: z
    .array(
      z.object({
        bezeichnung: z.string().trim().min(1).max(300),
        kategorie_name: z.string().trim().max(200).optional().nullable(),
        menge: z.number().finite().min(0),
        preis: z.number().finite().min(0),
      }),
    )
    .max(200)
    .default([]),
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

export const Route = createFileRoute("/api/public/n8n/rechnung")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (request.headers.get("x-api-token") !== API_TOKEN) {
          return json({ error: "unauthorized" }, 401);
        }

        let parsed;
        try {
          parsed = schema.parse(await request.json());
        } catch {
          return json({ error: "invalid payload" }, 400);
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const stammdaten: {
          kontaktperson?: string;
          telefon?: string;
          email?: string;
          adresse?: string;
          kundennummer?: string;
          iban?: string;
        } = {};
        const setze = (key: keyof typeof stammdaten, wert?: string | null) => {
          if (wert != null && wert.trim() !== "") stammdaten[key] = wert.trim();
        };
        setze("kontaktperson", parsed.lieferant_kontaktperson);
        setze("telefon", parsed.lieferant_telefon);
        setze("email", parsed.lieferant_email);
        setze("adresse", parsed.lieferant_adresse);
        setze("kundennummer", parsed.lieferant_kundennummer);
        setze("iban", parsed.lieferant_iban);

        // 1. Duplikat-Check
        const existing = await supabaseAdmin
          .from("rechnungen")
          .select("id")
          .eq("gmail_message_id", parsed.gmail_message_id)
          .maybeSingle();
        if (existing.error) return json({ error: existing.error.message }, 500);
        if (existing.data) {
          return json({ status: "already exists", rechnung_id: existing.data.id });
        }

        // 2. Lieferant finden oder anlegen
        let lieferantId: string | null = null;
        const lief = await supabaseAdmin
          .from("lieferanten")
          .select("id")
          .ilike("name", parsed.lieferant_name)
          .limit(1)
          .maybeSingle();
        if (lief.error) return json({ error: lief.error.message }, 500);
        if (lief.data) {
          lieferantId = lief.data.id;
          if (Object.keys(stammdaten).length) {
            const upd = await supabaseAdmin
              .from("lieferanten")
              .update(stammdaten)
              .eq("id", lieferantId);
            if (upd.error) return json({ error: upd.error.message }, 500);
          }
        } else {
          const neu = await supabaseAdmin
            .from("lieferanten")
            .insert({ name: parsed.lieferant_name, ...stammdaten })
            .select("id")
            .single();
          if (neu.error) return json({ error: neu.error.message }, 500);
          lieferantId = neu.data.id;
        }

        // 3. Rechnung anlegen
        const rechnung = await supabaseAdmin
          .from("rechnungen")
          .insert({
            rechnungsnummer: parsed.rechnungsnummer,
            lieferant_id: lieferantId,
            datum: parsed.datum,
            gesamtbetrag: parsed.gesamtbetrag,
            pdf_url: parsed.pdf_url ?? null,
            gmail_message_id: parsed.gmail_message_id,
          })
          .select("id")
          .single();
        if (rechnung.error) return json({ error: rechnung.error.message }, 500);

        // 4. Kategorien auflösen
        if (parsed.positionen.length) {
          const kats = await supabaseAdmin.from("kategorien").select("id, name");
          if (kats.error) return json({ error: kats.error.message }, 500);
          const alle = kats.data ?? [];
          const fallback = alle[0]?.id ?? null;
          const findKat = (name?: string | null) => {
            if (!name) return fallback;
            const hit = alle.find((k) => k.name.toLowerCase() === name.trim().toLowerCase());
            return hit?.id ?? fallback;
          };

          // 5. Produkte auflösen bzw. anlegen und Positionen schreiben
          const rows: Array<{
            rechnung_id: string;
            bezeichnung: string;
            kategorie_id: string | null;
            produkt_id: string | null;
            menge: number;
            preis: number;
          }> = [];

          for (const p of parsed.positionen) {
            const katId = findKat(p.kategorie_name);
            let produktId: string | null = null;

            const vorhanden = await supabaseAdmin
              .from("produkte")
              .select("id")
              .ilike("name", p.bezeichnung)
              .limit(1)
              .maybeSingle();
            if (vorhanden.error) return json({ error: vorhanden.error.message }, 500);

            if (vorhanden.data) {
              produktId = vorhanden.data.id;
            } else {
              const neuesProdukt = await supabaseAdmin
                .from("produkte")
                .insert({
                  name: p.bezeichnung,
                  kategorie_id: katId,
                  lieferant_id: lieferantId,
                  einheit: "stück",
                  aktueller_bestand: 0,
                })
                .select("id")
                .single();
              if (neuesProdukt.error) return json({ error: neuesProdukt.error.message }, 500);
              produktId = neuesProdukt.data.id;
            }

            rows.push({
              rechnung_id: rechnung.data.id,
              bezeichnung: p.bezeichnung,
              kategorie_id: katId,
              produkt_id: produktId,
              menge: p.menge,
              preis: p.preis,
            });
          }

          const pos = await supabaseAdmin.from("rechnungspositionen").insert(rows);
          if (pos.error) return json({ error: pos.error.message }, 500);
        }

        // 6. Erfolg
        return json({
          status: "created",
          rechnung_id: rechnung.data.id,
          lieferant_id: lieferantId,
          positionen: parsed.positionen.length,
        });
      },
    },
  },
});