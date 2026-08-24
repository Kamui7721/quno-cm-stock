import { db } from "./db";

export const PREISALARM_SCHLUESSEL = "preisalarm_schwelle";
export const PREISALARM_STANDARD = 10;

export async function einstellungLaden(schluessel: string): Promise<string | null> {
  const { data, error } = await db
    .from("einstellungen")
    .select("wert")
    .eq("schluessel", schluessel);
  if (error) throw new Error(error.message);
  return (data as { wert: string }[] | null)?.[0]?.wert ?? null;
}

export async function einstellungSpeichern(schluessel: string, wert: string) {
  const vorhanden = await einstellungLaden(schluessel);
  const res =
    vorhanden === null
      ? await db.from("einstellungen").insert({ schluessel, wert })
      : await db
          .from("einstellungen")
          .update({ wert, aktualisiert_am: new Date().toISOString() })
          .eq("schluessel", schluessel);
  if (res.error) throw new Error(res.error.message);
}

export async function preisalarmSchwelleLaden(): Promise<number> {
  const wert = await einstellungLaden(PREISALARM_SCHLUESSEL);
  const n = Number(String(wert ?? "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : PREISALARM_STANDARD;
}
