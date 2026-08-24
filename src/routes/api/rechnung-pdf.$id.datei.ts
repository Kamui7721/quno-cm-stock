import { createFileRoute } from "@tanstack/react-router";
import { tokenAusHeader, tokenGueltig } from "@/lib/gate.server";
import { belegPfad } from "@/lib/beleg";

const BUCKET = "rechnungen";

const fehler = (nachricht: string, status: number) =>
  new Response(nachricht, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });

/**
 * Liefert den Beleg gleichursprünglich (same-origin) und inline aus.
 * Nötig, weil verschachtelte Cross-Origin-PDFs im Vorschau-iframe blockiert werden.
 */
export const Route = createFileRoute("/api/rechnung-pdf/$id/datei")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        if (!tokenGueltig(tokenAusHeader(request.headers.get("cookie")))) {
          return fehler("Nicht angemeldet", 401);
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const rechnung = await supabaseAdmin
          .from("rechnungen")
          .select("pdf_url, pdf_dateiname")
          .eq("id", params.id)
          .maybeSingle();
        if (rechnung.error) return fehler(rechnung.error.message, 500);
        if (!rechnung.data) return fehler("Rechnung nicht gefunden", 404);

        const pfad = belegPfad(rechnung.data.pdf_url);
        if (!pfad) return fehler("Kein Beleg hinterlegt", 404);

        const datei = await supabaseAdmin.storage.from(BUCKET).download(pfad);
        if (datei.error || !datei.data) {
          return fehler(`Beleg nicht im Speicher gefunden (${pfad})`, 404);
        }

        const name = (rechnung.data.pdf_dateiname ?? "beleg.pdf").replace(/["\\\r\n]/g, "");
        return new Response(await datei.data.arrayBuffer(), {
          status: 200,
          headers: {
            "content-type": "application/pdf",
            "content-disposition": `inline; filename="${name}"`,
            "cache-control": "private, max-age=300",
          },
        });
      },
    },
  },
});
