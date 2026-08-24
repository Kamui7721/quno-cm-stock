import { createFileRoute } from "@tanstack/react-router";
import { tokenAusHeader, tokenGueltig } from "@/lib/gate.server";
import { belegPfad } from "@/lib/beleg";

const BUCKET = "rechnungen";
const MAX_BYTES = 4 * 1024 * 1024;
const PNG_SIGNATUR = [0x89, 0x50, 0x4e, 0x47];

const text = (nachricht: string, status: number) =>
  new Response(nachricht, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

/**
 * GET  → liefert das Vorschaubild (erste Seite des Belegs) gleichursprünglich aus.
 * POST → nimmt ein gerendertes PNG an, legt es im Bucket ab und merkt sich den Pfad.
 */
export const Route = createFileRoute("/api/rechnung-vorschau/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        if (!tokenGueltig(tokenAusHeader(request.headers.get("cookie")))) {
          return text("Nicht angemeldet", 401);
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const rechnung = await supabaseAdmin
          .from("rechnungen")
          .select("pdf_vorschau")
          .eq("id", params.id)
          .maybeSingle();
        if (rechnung.error) return text(rechnung.error.message, 500);

        const pfad = belegPfad(rechnung.data?.pdf_vorschau);
        if (!pfad) return text("Keine Vorschau hinterlegt", 404);

        const datei = await supabaseAdmin.storage.from(BUCKET).download(pfad);
        if (datei.error || !datei.data) {
          return text(`Vorschau nicht im Speicher gefunden (${pfad})`, 404);
        }

        return new Response(await datei.data.arrayBuffer(), {
          status: 200,
          headers: {
            "content-type": "image/png",
            "cache-control": "private, max-age=3600",
          },
        });
      },

      POST: async ({ request, params }) => {
        if (!tokenGueltig(tokenAusHeader(request.headers.get("cookie")))) {
          return json({ success: false, fehler: "Nicht angemeldet" }, 401);
        }

        const bytes = new Uint8Array(await request.arrayBuffer());
        if (bytes.byteLength === 0) {
          return json({ success: false, fehler: "Leerer Body" }, 400);
        }
        if (bytes.byteLength > MAX_BYTES) {
          return json({ success: false, fehler: "Vorschau ist zu groß" }, 413);
        }
        if (PNG_SIGNATUR.some((b, i) => bytes[i] !== b)) {
          return json({ success: false, fehler: "Datei ist kein PNG" }, 400);
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const rechnung = await supabaseAdmin
          .from("rechnungen")
          .select("id, datum")
          .eq("id", params.id)
          .maybeSingle();
        if (rechnung.error) return json({ success: false, fehler: rechnung.error.message }, 500);
        if (!rechnung.data) return json({ success: false, fehler: "Rechnung nicht gefunden" }, 404);

        const jahr = (rechnung.data.datum ?? new Date().toISOString()).slice(0, 4);
        const pfad = `${jahr}/${rechnung.data.id}_preview.png`;

        const up = await supabaseAdmin.storage
          .from(BUCKET)
          .upload(pfad, bytes, { contentType: "image/png", upsert: true });
        if (up.error) {
          return json({ success: false, fehler: `Upload fehlgeschlagen: ${up.error.message}` }, 500);
        }

        const upd = await supabaseAdmin
          .from("rechnungen")
          .update({ pdf_vorschau: pfad })
          .eq("id", rechnung.data.id);
        if (upd.error) return json({ success: false, fehler: upd.error.message }, 500);

        return json({ success: true, pfad });
      },
    },
  },
});
