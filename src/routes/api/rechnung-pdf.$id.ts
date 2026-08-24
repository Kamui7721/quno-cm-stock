import { createFileRoute } from "@tanstack/react-router";
import { tokenAusHeader, tokenGueltig } from "@/lib/gate.server";
import { belegPfad } from "@/lib/beleg";

const BUCKET = "rechnungen";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

export const Route = createFileRoute("/api/rechnung-pdf/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        if (!tokenGueltig(tokenAusHeader(request.headers.get("cookie")))) {
          return json({ error: "Nicht angemeldet" }, 401);
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const rechnung = await supabaseAdmin
          .from("rechnungen")
          .select("pdf_url")
          .eq("id", params.id)
          .maybeSingle();
        if (rechnung.error) return json({ error: rechnung.error.message }, 500);
        if (!rechnung.data) return json({ error: "Rechnung nicht gefunden" }, 404);

        const pfad = belegPfad(rechnung.data.pdf_url);
        if (!pfad) return json({ error: "Kein Beleg hinterlegt" }, 404);

        const signiert = await supabaseAdmin.storage
          .from(BUCKET)
          .createSignedUrl(pfad, 60 * 60);
        if (signiert.error || !signiert.data?.signedUrl) {
          return json({ error: "Beleg nicht im Speicher gefunden" }, 404);
        }

        return json({ url: signiert.data.signedUrl });
      },
    },
  },
});
