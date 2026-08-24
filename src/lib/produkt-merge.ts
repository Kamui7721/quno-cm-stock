import { db } from "@/lib/db";

/** Führt Quell-Produkt in Ziel-Produkt zusammen (Verknüpfungen umhängen, Bestand addieren). */
export async function produkteZusammenfuehren(zielId: string, quelleId: string) {
  if (zielId === quelleId) throw new Error("Ziel und Quelle sind identisch");

  const { data: beide, error: ladeFehler } = await db
    .from("produkte")
    .select("id, aktueller_bestand");
  if (ladeFehler) throw new Error(ladeFehler.message);
  const ziel = (beide ?? []).find((p: { id: string }) => p.id === zielId);
  const quelle = (beide ?? []).find((p: { id: string }) => p.id === quelleId);
  if (!ziel || !quelle) throw new Error("Produkte nicht gefunden");

  for (const tabelle of ["rechnungspositionen", "zaehlungspositionen", "verkaufszahlen"] as const) {
    const res = await db.from(tabelle).update({ produkt_id: zielId }).eq("produkt_id", quelleId);
    if (res.error) throw new Error(res.error.message);
  }

  const bestand = Number(ziel.aktueller_bestand ?? 0) + Number(quelle.aktueller_bestand ?? 0);
  const upd = await db.from("produkte").update({ aktueller_bestand: bestand }).eq("id", zielId);
  if (upd.error) throw new Error(upd.error.message);

  const del = await db.from("produkte").delete().eq("id", quelleId);
  if (del.error) throw new Error(del.error.message);
}
