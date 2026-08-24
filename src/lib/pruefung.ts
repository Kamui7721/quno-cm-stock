import { db } from "@/lib/db";
import { benutzerName } from "@/lib/benutzer";

/** Setzt oder entfernt den Prüfvermerk für mehrere Rechnungen. */
export async function pruefungSetzen(ids: string[], geprueft: boolean) {
  const werte = geprueft
    ? { geprueft: true, geprueft_am: new Date().toISOString(), geprueft_von: benutzerName() }
    : { geprueft: false, geprueft_am: null, geprueft_von: null };

  for (const id of ids) {
    const { error } = await db.from("rechnungen").update(werte).eq("id", id);
    if (error) throw new Error(error.message);
  }
}
