import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const API_TOKEN = "quno-cm-2026";

const schema = z.object({
  rechnungsnummer: z.string().trim().min(1).max(200),
  lieferant_name: z.string().trim().min(1).max(200),
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
        } else {
          const neu = await supabaseAdmin
            .from("lieferanten")
            .insert({ name: parsed.lieferant_name })
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

          // 5. Positionen schreiben
          const rows = parsed.positionen.map((p) => ({
            rechnung_id: rechnung.data.id,
            bezeichnung: p.bezeichnung,
            kategorie_id: findKat(p.kategorie_name),
            menge: p.menge,
            preis: p.preis,
          }));
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