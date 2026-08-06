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