import { assertGate } from "./gate.server";

export type ResetBereich = "zaehlungen" | "rechnungen" | "produkte";

export type ResetZaehlung = {
  bereich: "zaehlungen";
  zaehlungen: number;
  positionen: number;
};

export type ResetRechnungen = {
  bereich: "rechnungen";
  rechnungen: number;
  positionen: number;
  dateien: number;
};

export type ResetProdukte = {
  bereich: "produkte";
  produkte: number;
  positionenEntkoppelt: number;
};

export type ResetZahlen = ResetZaehlung | ResetRechnungen | ResetProdukte;

export type ResetErgebnis = {
  zahlen: ResetZahlen;
  /** Dateien, die im Bucket nicht gelöscht werden konnten. */
  verbliebeneDateien: string[];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function admin(): Promise<any> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function anzahl(sb: any, tabelle: string): Promise<number> {
  const { count, error } = await sb.from(tabelle).select("id", { count: "exact", head: true });
  if (error) throw new Error(error.message);
  return Number(count ?? 0);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function belegDateien(sb: any): Promise<string[]> {
  const { data, error } = await sb.from("rechnungen").select("pdf_url, pdf_vorschau");
  if (error) throw new Error(error.message);
  const pfade = new Set<string>();
  for (const r of (data ?? []) as Array<{ pdf_url: string | null; pdf_vorschau: string | null }>) {
    for (const p of [r.pdf_url, r.pdf_vorschau]) {
      const wert = (p ?? "").trim();
      if (wert && !wert.startsWith("http")) pfade.add(wert);
    }
  }
  return [...pfade];
}

/** Zählt, was ein Zurücksetzen betreffen würde — löscht nichts. */
export async function resetVorschau(bereich: ResetBereich): Promise<ResetZahlen> {
  assertGate();
  const sb = await admin();

  if (bereich === "zaehlungen") {
    return {
      bereich,
      zaehlungen: await anzahl(sb, "zaehlungen"),
      positionen: await anzahl(sb, "zaehlungspositionen"),
    };
  }

  if (bereich === "rechnungen") {
    return {
      bereich,
      rechnungen: await anzahl(sb, "rechnungen"),
      positionen: await anzahl(sb, "rechnungspositionen"),
      dateien: (await belegDateien(sb)).length,
    };
  }

  return {
    bereich,
    produkte: await anzahl(sb, "produkte"),
    positionenEntkoppelt: await anzahl(sb, "rechnungspositionen"),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function alleLoeschen(sb: any, tabelle: string): Promise<void> {
  const { error } = await sb
    .from(tabelle)
    .delete()
    .not("id", "is", null);
  if (error) throw new Error(`${tabelle}: ${error.message}`);
}

/** Führt das Zurücksetzen serverseitig aus (Positionen zuerst, dann der Hauptdatensatz). */
export async function resetAusfuehren(bereich: ResetBereich): Promise<ResetErgebnis> {
  assertGate();
  const sb = await admin();
  const zahlen = await resetVorschau(bereich);
  const verbliebeneDateien: string[] = [];

  if (bereich === "zaehlungen") {
    await alleLoeschen(sb, "zaehlungspositionen");
    await alleLoeschen(sb, "zaehlungen");
  }

  if (bereich === "rechnungen") {
    const dateien = await belegDateien(sb);
    if (dateien.length) {
      for (let i = 0; i < dateien.length; i += 50) {
        const teil = dateien.slice(i, i + 50);
        try {
          const { data, error } = await sb.storage.from("rechnungen").remove(teil);
          if (error) {
            verbliebeneDateien.push(...teil);
          } else {
            const entfernt = new Set(
              ((data ?? []) as Array<{ name?: string }>).map((d) => d.name ?? ""),
            );
            verbliebeneDateien.push(...teil.filter((p) => !entfernt.has(p)));
          }
        } catch {
          verbliebeneDateien.push(...teil);
        }
      }
    }
    await alleLoeschen(sb, "rechnungspositionen");
    await alleLoeschen(sb, "rechnungen");
  }

  if (bereich === "produkte") {
    // Verweise lösen, damit Fremdschlüssel nicht blockieren.
    const loesen = async (tabelle: string) => {
      const { error } = await sb
        .from(tabelle)
        .update({ produkt_id: null })
        .not("produkt_id", "is", null);
      if (error) throw new Error(`${tabelle}: ${error.message}`);
    };
    await loesen("rechnungspositionen");
    await loesen("verkaufszahlen");
    await loesen("zaehlungspositionen");
    await alleLoeschen(sb, "produkte");
  }

  return { zahlen, verbliebeneDateien };
}
