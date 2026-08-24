type SortierbareRechnung = {
  id: string;
  datum?: string | null;
  erstellt_am?: string | null;
};

/**
 * Standardsortierung für Rechnungen:
 * 1. erstellt_am absteigend
 * 2. Rechnungsdatum absteigend (bei identischem erstellt_am)
 * 3. id absteigend
 */
export function rechnungStandardSort(a: SortierbareRechnung, b: SortierbareRechnung) {
  const erstellt = String(b.erstellt_am ?? "").localeCompare(String(a.erstellt_am ?? ""));
  if (erstellt !== 0) return erstellt;
  const dat = String(b.datum ?? "").localeCompare(String(a.datum ?? ""));
  if (dat !== 0) return dat;
  return String(b.id).localeCompare(String(a.id));
}
