import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  PRODUKT_SCHWELLE,
  bezeichnungAehnlichkeit,
  levenshtein,
  normalisiereBezeichnung,
} from "@/lib/aehnlichkeit";
import { istKiste, standardFlaschenProKiste } from "@/lib/types";

const API_TOKEN = "quno-cm-2026";

const text = (max: number) => z.string().trim().max(max).nullish();
const zahl = z.union([z.number(), z.string()]).nullish().transform((v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
});

const schema = z.object({
  rechnungsnummer: text(200),
  datum: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullish(),
  gesamtbetrag: zahl,
  summe_netto: zahl,
  gmail_message_id: text(200),
  pdf_url: text(2000),
  lieferant_name: text(200),
  lieferant_kontaktperson: text(200),
  lieferant_telefon: text(100),
  lieferant_email: text(200),
  lieferant_adresse: text(500),
  lieferant_kundennummer: text(100),
  lieferant_iban: text(100),
  import_ok: z.boolean().nullish(),
  import_warnungen: text(4000),
  positionen: z.array(
    z.object({
      bezeichnung: z.string().trim().min(1).max(300),
      kategorie_name: text(200),
      menge: zahl,
      einheit: text(100),
      gebindegroesse: zahl,
      einzelpreis: zahl,
      gesamtpreis: zahl,
    }),
  ),
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const RECHTSFORMEN = [
  "gmbh", "mbh", "co", "kg", "ohg", "ag", "ug", "kgaa", "ltd", "limited",
  "llc", "inc", "bv", "nv", "sa", "sarl", "srl", "spa", "plc", "eg", "ev",
  "gbr", "und", "and",
];

const kernWoerter = (name: string) =>
  name
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter((w) => w !== "" && !RECHTSFORMEN.includes(w));

const lieferantAehnlichkeit = (a: string, b: string) => {
  const wa = kernWoerter(a);
  const wb = kernWoerter(b);
  if (!wa.length || !wb.length) return 0;
  const sa = wa.join(" ");
  const sb = wb.join(" ");
  if (sa === sb) return 1;
  const setB = new Set(wb);
  const treffer = wa.filter((w) => setB.has(w)).length;
  const overlap = treffer / Math.min(wa.length, wb.length);
  const chars = 1 - levenshtein(sa, sb) / Math.max(sa.length, sb.length);
  return Math.max(overlap, chars);
};

const extrahiereEinheit = (bezeichnung: string): string => {
  const lower = bezeichnung.toLowerCase();
  if (lower.includes("kg") || lower.includes("kilogramm")) return "kg";
  if (
    /\b\d*[,.]?\d*\s*l\b/.test(lower) ||
    lower.includes("liter") ||
    lower.includes("flasche") ||
    lower.includes("fl.") ||
    /x\s*0[,.]33/.test(lower) ||
    /x\s*0[,.]5/.test(lower) ||
    /x\s*0[,.]75/.test(lower)
  ) {
    return "l";
  }
  if (lower.includes("ml")) return "l";
  return "stück";
};

const normEinheit = (einheit?: string | null, bezeichnung = ""): string => {
  const e = (einheit ?? "").trim().toLowerCase();
  if (!e) return extrahiereEinheit(bezeichnung);
  if (e === "kg" || e === "kilogramm") return "kg";
  if (e === "l" || e === "liter" || e === "ltr") return "l";
  if (e === "g" || e === "gramm") return "g";
  if (e === "ml" || e === "milliliter") return "ml";
  if (e === "dose" || e === "dosen" || e === "ds") return "dose";
  if (e.includes("flasche") || e === "fl" || e === "btl") {
    if (/0[,.]75/.test(e)) return "flasche_075";
    if (/1[,.]?0?\s*l/.test(e) || e.includes("1l")) return "flasche_100";
    return "flasche_075";
  }
  if (e.includes("kiste") || e.includes("kasten") || e === "kst") {
    if (/\b6\b/.test(e)) return "kiste_6";
    if (/\b12\b/.test(e)) return "kiste_12";
    return "kiste";
  }
  return "stück";
};

export const Route = createFileRoute("/api/public/n8n/rechnung")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (request.headers.get("x-api-token") !== API_TOKEN) {
          return json({ error: "unauthorized" }, 401);
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return json({ error: "invalid json", grund: "Body konnte nicht als JSON gelesen werden" }, 400);
        }

        // Gesamtbetrag robust bereinigen (z. B. "571,20 €" → 571.2)
        if (typeof body === "object" && body !== null && "gesamtbetrag" in body) {
          const raw = (body as Record<string, unknown>)["gesamtbetrag"];
          const cleanBetrag = String(raw).replace(",", ".").replace(/[^0-9.]/g, "");
          const betrag = parseFloat(cleanBetrag);
          if (Number.isNaN(betrag)) {
            return json(
              { error: "invalid payload", grund: "gesamtbetrag ist keine gültige Zahl" },
              400,
            );
          }
          (body as Record<string, unknown>)["gesamtbetrag"] = betrag;
        }

        const result = schema.safeParse(body);
        if (!result.success) {
          return json(
            {
              error: "invalid payload",
              grund: result.error.issues
                .map((i) => `${i.path.join(".") || "body"}: ${i.message}`)
                .join(" | "),
              felder: result.error.issues.map((i) => i.path.join(".")),
            },
            400,
          );
        }
        const parsed = result.data;

        const lieferantName = (parsed.lieferant_name ?? "").trim();
        if (!lieferantName) {
          return json({ error: "invalid payload", grund: "lieferant_name fehlt" }, 400);
        }
        if (parsed.gesamtbetrag === null) {
          return json({ error: "invalid payload", grund: "gesamtbetrag fehlt oder ist keine Zahl" }, 400);
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
        const gmailId = (parsed.gmail_message_id ?? "").trim();
        if (gmailId) {
          const existing = await supabaseAdmin
            .from("rechnungen")
            .select("id")
            .eq("gmail_message_id", gmailId)
            .maybeSingle();
          if (existing.error) return json({ error: existing.error.message }, 500);
          if (existing.data) {
            return json({ status: "already exists", rechnung_id: existing.data.id });
          }
        }

        // 2. Lieferant finden oder anlegen
        let lieferantId: string | null = null;
        const lief = await supabaseAdmin
          .from("lieferanten")
          .select("id")
          .ilike("name", lieferantName)
          .limit(1)
          .maybeSingle();
        if (lief.error) return json({ error: lief.error.message }, 500);
        if (lief.data) {
          lieferantId = lief.data.id;
        } else if (lieferantName.toLowerCase() !== "unbekannt") {
          const alleLief = await supabaseAdmin.from("lieferanten").select("id, name");
          if (alleLief.error) return json({ error: alleLief.error.message }, 500);
          let best: { id: string; score: number } | null = null;
          for (const l of alleLief.data ?? []) {
            const score = lieferantAehnlichkeit(lieferantName, l.name);
            if (!best || score > best.score) best = { id: l.id, score };
          }
          if (best && best.score > 0.8) lieferantId = best.id;
        }

        if (lieferantId) {
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
            .insert({ name: lieferantName, ...stammdaten })
            .select("id")
            .single();
          if (neu.error) return json({ error: neu.error.message }, 500);
          lieferantId = neu.data.id;
        }

        const importOk = parsed.import_ok ?? true;

        // 3. Rechnung anlegen
        const rechnung = await supabaseAdmin
          .from("rechnungen")
          .insert({
            rechnungsnummer: parsed.rechnungsnummer?.trim() || "ohne Nummer",
            lieferant_id: lieferantId,
            datum: parsed.datum ?? new Date().toISOString().slice(0, 10),
            gesamtbetrag: parsed.gesamtbetrag,
            summe_netto: parsed.summe_netto,
            pdf_url: parsed.pdf_url ?? null,
            gmail_message_id: gmailId || null,
            import_ok: importOk,
            import_warnungen: parsed.import_warnungen ?? null,
            geprueft: false,
          })
          .select("id")
          .single();
        if (rechnung.error) return json({ error: rechnung.error.message }, 500);

        let neueProdukte = 0;
        let zugeordnet = 0;

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

          // Produktbestand einmalig laden (für exakte + unscharfe Suche)
          const prodRes = await supabaseAdmin
            .from("produkte")
            .select("id, name, bezeichnung_normalisiert, lieferant_id, stueck_pro_einheit");
          if (prodRes.error) return json({ error: prodRes.error.message }, 500);
          const produkte = (prodRes.data ?? []).map((p) => ({
            id: p.id,
            lieferant_id: p.lieferant_id,
            stueck_pro_einheit: p.stueck_pro_einheit as number | null,
            norm: p.bezeichnung_normalisiert || normalisiereBezeichnung(p.name),
          }));

          const rows: Array<{
            rechnung_id: string;
            bezeichnung: string;
            kategorie_id: string | null;
            produkt_id: string | null;
            menge: number;
            preis: number;
            einzelpreis: number | null;
            einheit: string;
            gebindegroesse: number | null;
            flaschen_pro_kiste: number | null;
          }> = [];

          for (const p of parsed.positionen) {
            const katId = findKat(p.kategorie_name);
            const norm = normalisiereBezeichnung(p.bezeichnung);
            const einheit = normEinheit(p.einheit, p.bezeichnung);

            // 1) exakter Treffer auf normalisierter Bezeichnung
            let treffer = produkte.find((x) => x.norm === norm) ?? null;

            // 2) unscharfe Suche
            if (!treffer) {
              let best: { p: (typeof produkte)[number]; score: number } | null = null;
              for (const x of produkte) {
                const score = bezeichnungAehnlichkeit(norm, x.norm);
                if (!best || score > best.score) best = { p: x, score };
              }
              if (best && best.score >= PRODUKT_SCHWELLE) treffer = best.p;
            }

            const gebinde =
              p.gebindegroesse && p.gebindegroesse > 0
                ? Math.round(p.gebindegroesse)
                : null;

            let produktId: string;
            if (treffer) {
              produktId = treffer.id;
              zugeordnet++;
              if (!treffer.lieferant_id && lieferantId) {
                const upd = await supabaseAdmin
                  .from("produkte")
                  .update({ lieferant_id: lieferantId, bezeichnung_normalisiert: treffer.norm })
                  .eq("id", treffer.id);
                if (upd.error) return json({ error: upd.error.message }, 500);
                treffer.lieferant_id = lieferantId;
              }
              // Stück pro Einheit aus Gebindegröße übernehmen, falls noch nicht gesetzt
              if (gebinde && (treffer.stueck_pro_einheit == null || treffer.stueck_pro_einheit <= 0)) {
                const upd = await supabaseAdmin
                  .from("produkte")
                  .update({ stueck_pro_einheit: gebinde })
                  .eq("id", treffer.id)
                  .is("stueck_pro_einheit", null);
                if (upd.error) return json({ error: upd.error.message }, 500);
                treffer.stueck_pro_einheit = gebinde;
              }
              // Einheit auf "kiste" setzen, wenn Gebindegröße erkannt und noch keine Kiste
              if (gebinde && !istKiste((treffer as { einheit?: string }).einheit)) {
                const upd = await supabaseAdmin
                  .from("produkte")
                  .update({ einheit: "kiste" })
                  .eq("id", treffer.id);
                if (upd.error) return json({ error: upd.error.message }, 500);
                (treffer as { einheit?: string }).einheit = "kiste";
              }
            } else {
              const neuesProdukt = await supabaseAdmin
                .from("produkte")
                .insert({
                  name: p.bezeichnung.trim(),
                  bezeichnung_normalisiert: norm,
                  kategorie_id: katId,
                  lieferant_id: lieferantId,
                  einheit,
                  aktueller_bestand: 0,
                  stueck_pro_einheit: gebinde,
                })
                .select("id")
                .single();
              if (neuesProdukt.error) return json({ error: neuesProdukt.error.message }, 500);
              produktId = neuesProdukt.data.id;
              neueProdukte++;
              produkte.push({ id: produktId, lieferant_id: lieferantId, stueck_pro_einheit: gebinde, norm });
            }

            const menge = p.menge ?? 0;
            const gesamtpreis = p.gesamtpreis ?? 0;
            const einzelpreis =
              p.einzelpreis ?? (menge !== 0 ? gesamtpreis / menge : null);

            rows.push({
              rechnung_id: rechnung.data.id,
              bezeichnung: p.bezeichnung.trim(),
              kategorie_id: katId,
              produkt_id: produktId,
              menge,
              preis: gesamtpreis,
              einzelpreis,
              einheit,
              gebindegroesse: p.gebindegroesse,
              flaschen_pro_kiste: istKiste(einheit)
                ? (standardFlaschenProKiste(einheit) ??
                  (p.gebindegroesse ? Math.round(p.gebindegroesse) : null))
                : null,
            });
          }

          const pos = await supabaseAdmin.from("rechnungspositionen").insert(rows);
          if (pos.error) return json({ error: pos.error.message }, 500);
        }

        return json({
          status: "created",
          rechnung_id: rechnung.data.id,
          lieferant_id: lieferantId,
          positionen: parsed.positionen.length,
          produkte_zugeordnet: zugeordnet,
          produkte_neu: neueProdukte,
          import_ok: importOk,
        });
      },
    },
  },
});
