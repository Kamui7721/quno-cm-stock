export const eur = (n: number | null | undefined) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(Number(n ?? 0));

export const num = (n: number | null | undefined, digits = 2) =>
  new Intl.NumberFormat("de-DE", { maximumFractionDigits: digits }).format(Number(n ?? 0));

export const datum = (d: string | null | undefined) =>
  d ? new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(d)) : "–";

export const monatLabel = (m: string) => {
  const [y, mo] = m.split("-");
  const names = [
    "Januar", "Februar", "März", "April", "Mai", "Juni",
    "Juli", "August", "September", "Oktober", "November", "Dezember",
  ];
  return `${names[Number(mo) - 1] ?? m} ${y}`;
};

export const heutigerMonat = () => new Date().toISOString().slice(0, 7);
export const einheitLabel = (e: string | null | undefined) => {
  if (!e) return "–";
  return EINHEIT_LABELS[e.trim().toLowerCase()] ?? e;
};

export const datumZeit = (d: string | null | undefined) =>
  d
    ? new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short" }).format(
        new Date(d),
      )
    : "–";

/** Verschiebt einen Monat im Format YYYY-MM um n Monate. */
export const monatVerschieben = (m: string, n: number) => {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(Date.UTC(y!, (mo ?? 1) - 1 + n, 1));
  return d.toISOString().slice(0, 7);
};

export const monatKurz = (m: string) => monatLabel(m).split(" ")[0] ?? m;
