import type { DbOp } from "./db-schema";
import { assertGate } from "./gate.server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DbErgebnis = { data: any; error: { message: string } | null };

export async function runDbOp(op: DbOp): Promise<DbErgebnis> {
  assertGate();

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tabelle = supabaseAdmin.from(op.table) as any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any;
  if (op.action === "select") {
    q = tabelle.select(op.columns ?? "*");
  } else if (op.action === "insert") {
    if (!op.values) return { data: null, error: { message: "Keine Daten übergeben" } };
    q = tabelle.insert(op.values);
    if (op.returning) q = q.select(op.returning);
  } else if (op.action === "update") {
    if (!op.values) return { data: null, error: { message: "Keine Daten übergeben" } };
    q = tabelle.update(op.values);
    if (op.returning) q = q.select(op.returning);
  } else {
    q = tabelle.delete();
  }

  for (const f of op.filters ?? []) q = q.eq(f.column, f.value);
  if (op.order) q = q.order(op.order.column, { ascending: op.order.ascending });
  if (op.single) q = q.single();

  const { data, error } = await q;
  return {
    data: data ?? null,
    error: error ? { message: error.message } : null,
  };
}