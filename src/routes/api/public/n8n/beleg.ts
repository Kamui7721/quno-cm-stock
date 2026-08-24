import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const API_TOKEN = "quno-cm-2026";
const MAX_BYTES = 10 * 1024 * 1024;
const WARNUNG_KEIN_PDF = "Kein PDF im Storage abgelegt";

const text = (max: number) => z.string().trim().max(max).nullish();

const schema = z.object({
  rechnung_id: z.string().trim().uuid().nullish(),
  rechnungsnummer: text(200),
  lieferant_name: text(200),
  gmail_message_id: text(200),
  dateiname: text(300),
  pdf_base64: z.string().min(1),
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

export const Route = createFileRoute("/api/public/n8n/beleg")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          if (request.headers.get("x-api-token") !== API_TOKEN) {
            return json({ success: false, fehler: "Ungültiger API-Token" }, 401);
          }

          let rohdaten: unknown;
          try {
            rohdaten = await request.json();
          } catch {
            return json({ success: false, fehler: "Body ist kein gültiges JSON" }, 400);
          }

          const parsed = schema.safeParse(rohdaten);
          if (!parsed.success) {
            return json(
              {
                success: false,
                fehler: "Ungültige Eingabedaten",
                details: parsed.error.issues.map((i) => ({
                  feld: i.path.join("."),
                  meldung: i.message,
                })),
              },
              400,
            );
          }
          const d = parsed.data;

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          // 1. Rechnung finden
          type Treffer = {
            id: string;
            datum: string | null;
            lieferant_id: string | null;
            import_warnungen: string | null;
          };
          const spalten = "id, datum, lieferant_id, import_warnungen";
          let rechnung: Treffer | null = null;

          if (d.rechnung_id) {
            const res = await supabaseAdmin
              .from("rechnungen")
              .select(spalten)
              .eq("id", d.rechnung_id)
              .maybeSingle();
            rechnung = (res.data as Treffer | null) ?? null;
            if (!rechnung) {
              return json(
                { success: false, fehler: `Keine Rechnung mit id ${d.rechnung_id} gefunden` },
                404,
              );
            }
          }

          if (!rechnung && d.gmail_message_id) {
            const res = await supabaseAdmin
              .from("rechnungen")
              .select(spalten)
              .eq("gmail_message_id", d.gmail_message_id)
              .maybeSingle();
            rechnung = (res.data as Treffer | null) ?? null;
          }

          if (!rechnung && d.rechnungsnummer) {
            const res = await supabaseAdmin
              .from("rechnungen")
              .select(spalten)
              .eq("rechnungsnummer", d.rechnungsnummer);
            let kandidaten = (res.data as Treffer[] | null) ?? [];

            if (kandidaten.length > 1 && d.lieferant_name) {
              const lief = await supabaseAdmin
                .from("lieferanten")
                .select("id")
                .ilike("name", d.lieferant_name);
              const ids = new Set((lief.data ?? []).map((l) => l.id));
              const gefiltert = kandidaten.filter(
                (k) => k.lieferant_id && ids.has(k.lieferant_id),
              );
              if (gefiltert.length) kandidaten = gefiltert;
            }

            if (kandidaten.length > 1) {
              return json(
                {
                  success: false,
                  fehler: `Rechnungsnummer ${d.rechnungsnummer} ist nicht eindeutig (${kandidaten.length} Treffer). Bitte rechnung_id oder lieferant_name mitsenden.`,
                },
                404,
              );
            }
            rechnung = kandidaten[0] ?? null;
          }

          if (!rechnung) {
            return json(
              {
                success: false,
                fehler:
                  "Keine zugehörige Rechnung gefunden (rechnung_id, gmail_message_id und rechnungsnummer ergaben keinen Treffer)",
              },
              404,
            );
          }

          // 2. Base64 dekodieren
          const base64 = d.pdf_base64.replace(/^data:[^;]*;base64,/, "").replace(/\s/g, "");
          let bytes: Uint8Array;
          try {
            const bin = atob(base64);
            bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
          } catch {
            return json({ success: false, fehler: "pdf_base64 ist kein gültiges Base64" }, 400);
          }

          // 3. PDF-Signatur prüfen
          const signatur = String.fromCharCode(...bytes.slice(0, 4));
          if (signatur !== "%PDF") {
            return json(
              { success: false, fehler: "Datei ist kein PDF (Signatur %PDF fehlt)" },
              400,
            );
          }

          // 4. Größe
          if (bytes.byteLength > MAX_BYTES) {
            return json(
              {
                success: false,
                fehler: `Datei ist zu groß (${(bytes.byteLength / 1024 / 1024).toFixed(1)} MB, erlaubt sind 10 MB)`,
              },
              413,
            );
          }

          // 5. Upload
          const jahr = (rechnung.datum ?? new Date().toISOString()).slice(0, 4);
          const pfad = `${jahr}/${rechnung.id}.pdf`;
          const up = await supabaseAdmin.storage
            .from("rechnungen")
            .upload(pfad, bytes, { contentType: "application/pdf", upsert: true });
          if (up.error) {
            return json(
              { success: false, fehler: `Upload fehlgeschlagen: ${up.error.message}` },
              500,
            );
          }

          // 6./7. Rechnung aktualisieren
          const warnungen = (rechnung.import_warnungen ?? "")
            .split(/\r?\n|;/)
            .map((w) => w.trim())
            .filter((w) => w !== "" && w.toLowerCase() !== WARNUNG_KEIN_PDF.toLowerCase());
          const neueWarnungen = warnungen.length ? warnungen.join("\n") : null;

          const update: Record<string, unknown> = {
            pdf_url: pfad,
            pdf_dateiname: d.dateiname ?? null,
            import_warnungen: neueWarnungen,
          };
          if (!neueWarnungen) update["import_ok"] = true;

          const upd = await supabaseAdmin
            .from("rechnungen")
            .update(update)
            .eq("id", rechnung.id);
          if (upd.error) {
            return json(
              { success: false, fehler: `Rechnung konnte nicht aktualisiert werden: ${upd.error.message}` },
              500,
            );
          }

          return json({ success: true, pfad, rechnung_id: rechnung.id });
        } catch (e) {
          return json(
            { success: false, fehler: e instanceof Error ? e.message : "Unbekannter Fehler" },
            500,
          );
        }
      },
    },
  },
});
