import type { Database } from "@/integrations/supabase/types";

type T = Database["public"]["Tables"];
export type Kategorie = T["kategorien"]["Row"];
export type Lieferant = T["lieferanten"]["Row"];
export type Produkt = T["produkte"]["Row"];
export type Rechnung = T["rechnungen"]["Row"];
export type Rechnungsposition = T["rechnungspositionen"]["Row"];
export type Zaehlung = T["zaehlungen"]["Row"];
export type Zaehlungsposition = T["zaehlungspositionen"]["Row"];
export type Verkaufszahl = T["verkaufszahlen"]["Row"];

export const EINHEITEN = [
  { wert: "stück", label: "Stück" },
  { wert: "l", label: "Liter" },
  { wert: "kg", label: "Kilogramm" },
  { wert: "g", label: "Gramm" },
  { wert: "ml", label: "Milliliter" },
  { wert: "flasche_075", label: "Flasche (0,75 l)" },
  { wert: "flasche_100", label: "Flasche (1,0 l)" },
  { wert: "kiste_6", label: "Kiste (6 Flaschen)" },
  { wert: "kiste_12", label: "Kiste (12 Flaschen)" },
  { wert: "kiste", label: "Kiste" },
  { wert: "dose", label: "Dose" },
] as const;

export const EINHEIT_LABELS: Record<string, string> = Object.fromEntries(
  EINHEITEN.map((e) => [e.wert, e.label]),
);