/** Gemeinsame Logik für die Preishistorie (Einkaufspreise pro Produkt). */

export type EinkaufRoh = {
  id: string;
  rechnung_id: string;
  menge: number | string | null;
  preis: number | string | null;
  einzelpreis: number | string | null;
  rechnungen?: {
    datum: string | null;
    rechnungsnummer: string | null;
    lieferanten?: { name: string | null } | null;
  } | null;
};

export type Einkauf = {
  id: string;
  rechnungId: string;
  datum: string | null;
  rechnungsnummer: string;
  lieferant: string;
  menge: number;
  einzelpreis: number | null;
  gesamtpreis: number;
  ausreisser: boolean;
};

export const median = (werte: number[]): number | null => {
  const s = werte.filter((w) => Number.isFinite(w) && w > 0).sort((a, b) => a - b);
  if (s.length === 0) return null;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? (s[m] as number) : (((s[m - 1] as number) + (s[m] as number)) / 2);
};

/** Ein Wert gilt als Ausreißer, wenn er über dem 10-fachen oder unter einem Zehntel des Medians liegt. */
export const istAusreisser = (wert: number | null, med: number | null) =>
  !!wert && !!med && (wert > med * 10 || wert < med / 10);

/** Wandelt Rechnungspositionen in eine sortierte Einkaufsliste mit Ausreißer-Markierung um. */
export function baueEinkaeufe(rohdaten: EinkaufRoh[]): Einkauf[] {
  const einzel = (r: EinkaufRoh) => {
    const ep = Number(r.einzelpreis ?? NaN);
    if (Number.isFinite(ep) && ep > 0) return ep;
    const menge = Number(r.menge ?? 0);
    const preis = Number(r.preis ?? 0);
    return menge !== 0 ? preis / menge : null;
  };

  const med = median(rohdaten.map((r) => einzel(r) ?? 0));

  return rohdaten
    .map((r) => {
      const ep = einzel(r);
      return {
        id: r.id,
        rechnungId: r.rechnung_id,
        datum: r.rechnungen?.datum ?? null,
        rechnungsnummer: r.rechnungen?.rechnungsnummer ?? "–",
        lieferant: r.rechnungen?.lieferanten?.name ?? "–",
        menge: Number(r.menge ?? 0),
        einzelpreis: ep,
        gesamtpreis: Number(r.preis ?? 0),
        ausreisser: istAusreisser(ep, med),
      };
    })
    .sort((a, b) => String(a.datum ?? "").localeCompare(String(b.datum ?? "")));
}

export const vorZwoelfMonaten = () => {
  const d = new Date();
  d.setMonth(d.getMonth() - 12);
  return d.toISOString().slice(0, 10);
};

/** Prozentuale Abweichung von b nach a. */
export const abweichungProzent = (a: number | null, b: number | null) =>
  a !== null && b !== null && b > 0 ? ((a - b) / b) * 100 : null;

export const trendTone = (p: number | null): "danger" | "success" | "neutral" =>
  p === null ? "neutral" : p > 5 ? "danger" : p < -5 ? "success" : "neutral";

export const trendLabel = (p: number | null) =>
  p === null
    ? "–"
    : `${p > 0 ? "▲" : p < 0 ? "▼" : "■"} ${new Intl.NumberFormat("de-DE", {
        maximumFractionDigits: 0,
      }).format(Math.abs(p))} %`;
