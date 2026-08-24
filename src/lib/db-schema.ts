import { z } from "zod";

export const TABELLEN = [
  "kategorien",
  "lieferanten",
  "produkte",
  "rechnungen",
  "rechnungspositionen",
  "zaehlungen",
  "zaehlungspositionen",
  "verkaufszahlen",
  "lieferant_kategorien",
] as const;

const spalte = z.string().regex(/^[a-z_][a-z0-9_]*$/);
const skalar = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const zeile = z.record(z.string().regex(/^[a-z_][a-z0-9_]*$/), skalar);

export const dbOpSchema = z.object({
  table: z.enum(TABELLEN),
  action: z.enum(["select", "insert", "update", "delete"]),
  columns: z.string().max(400).optional(),
  returning: z.string().max(400).optional(),
  values: z.union([zeile, z.array(zeile).max(500)]).optional(),
  filters: z.array(z.object({ column: spalte, value: skalar })).max(5).optional(),
  order: z.object({ column: spalte, ascending: z.boolean() }).optional(),
  single: z.boolean().optional(),
});

export type DbOp = z.infer<typeof dbOpSchema>;