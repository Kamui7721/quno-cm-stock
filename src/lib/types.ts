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

export const EINHEITEN = ["kg", "l", "stück"] as const;