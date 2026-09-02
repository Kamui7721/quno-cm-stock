import { createFileRoute } from "@tanstack/react-router";
import { tokenAusHeader, tokenGueltig } from "@/lib/gate.server";

const BUCKET = "rechnungen";
const MAX_BYTES = 10 * 1024 * 1024;
const PDF_SIGNATUR = [0x25, 0x50, 0x44, 0x46]; // %PDF

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

/** POST → nimmt eine PDF-Datei an, legt sie im Bucket ab und verknüpft sie mit der Rechnung. */
export const Route = createFileRoute("/api/rechnung-beleg/$id")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        if (!tokenGueltig(tokenAusHeader(request.headers.get("cookie")))) {
          return json({ success: false, fehler: "Nicht angemeldet" }, 401);
        }

        const bytes = new Uint8Array(await request.arrayBuffer());
        if (bytes.byteLength === 0) return json({ success: false, fehler: "Leerer Body" }, 400);
        if (bytes.byteLength > MAX_BYTES) {
          return json({ success: false, fehler: "Datei ist größer als 10 MB" }, 413);
        }
        if (PDF_SIGNATUR.some((b, i) => bytes[i] !== b)) {
          return json({ success: false, fehler: "Datei ist kein PDF" }, 400);
        }

        const rohname = request.headers.get("x-dateiname") ?? "";
        const dateiname =
          decodeURIComponent(rohname).split("/").pop()?.slice(0, 200).trim() || "beleg.pdf";

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const rechnung = await supabaseAdmin
          .from("rechnungen")
          .select("id, datum")
          .eq("id", params.id)
          .maybeSingle();
        if (rechnung.error) return json({ success: false, fehler: rechnung.error.message }, 500);
        if (!rechnung.data) return json({ success: false, fehler: "Rechnung nicht gefunden" }, 404);

        const jahr = (rechnung.data.datum ?? new Date().toISOString()).slice(0, 4);
        const pfad = `${jahr}/${rechnung.data.id}.pdf`;

        const up = await supabaseAdmin.storage
          .from(BUCKET)
          .upload(pfad, bytes, { contentType: "application/pdf", upsert: true });
        if (up.error) {
          return json({ success: false, fehler: `Upload fehlgeschlagen: ${up.error.message}` }, 500);
        }

        const upd = await supabaseAdmin
          .from("rechnungen")
          .update({ pdf_url: pfad, pdf_dateiname: dateiname, import_ok: true })
          .eq("id", rechnung.data.id);
        if (upd.error) return json({ success: false, fehler: upd.error.message }, 500);

        return json({ success: true, pfad, dateiname });
      },
    },
  },
});
