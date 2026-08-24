/**
 * pdf_url enthält den Dateipfad im Bucket "rechnungen".
 * Bei Altdaten mit vollständiger URL wird alles bis einschließlich
 * "/rechnungen/" abgeschnitten.
 */
export function belegPfad(wert?: string | null): string | null {
  const rohwert = (wert ?? "").trim();
  if (!rohwert) return null;
  const index = rohwert.lastIndexOf("/rechnungen/");
  const pfad = index >= 0 ? rohwert.slice(index + "/rechnungen/".length) : rohwert;
  const sauber = pfad.replace(/^\/+/, "").split("?")[0]?.trim() ?? "";
  return sauber || null;
}

/** Holt eine signierte URL (60 Minuten gültig) für den Beleg einer Rechnung. */
export async function belegUrlHolen(rechnungId: string): Promise<string> {
  const res = await fetch(`/api/rechnung-pdf/${rechnungId}`, { credentials: "include" });
  const body = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
  if (!res.ok || !body?.url) {
    throw new Error(body?.error ?? "Beleg konnte nicht geladen werden");
  }
  return body.url;
}
