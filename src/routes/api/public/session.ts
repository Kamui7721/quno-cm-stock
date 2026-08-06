import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import {
  clearCookieHeader,
  sessionToken,
  setCookieHeader,
  tokenAusHeader,
  tokenGueltig,
} from "@/lib/gate.server";

const loginSchema = z.object({ passwort: z.string().min(1).max(200) });

function json(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
}

export const Route = createFileRoute("/api/public/session")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const ok = tokenGueltig(tokenAusHeader(request.headers.get("cookie")));
        return json({ ok });
      },
      POST: async ({ request }) => {
        let passwort = "";
        try {
          passwort = loginSchema.parse(await request.json()).passwort;
        } catch {
          return json({ ok: false }, { status: 400 });
        }
        const token = sessionToken(passwort);
        if (!token) return json({ ok: false }, { status: 401 });
        return json({ ok: true }, { headers: { "set-cookie": setCookieHeader(token) } });
      },
      DELETE: async () =>
        json({ ok: true }, { headers: { "set-cookie": clearCookieHeader() } }),
    },
  },
});