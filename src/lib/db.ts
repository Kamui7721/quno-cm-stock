import type { DbOp, TABELLEN } from "./db-schema";
import { dbRequest } from "./db.functions";

type Tabelle = (typeof TABELLEN)[number];
type Ergebnis = { data: any; error: { message: string } | null };

/**
 * Kleiner Supabase-ähnlicher Query-Builder, der alle Datenzugriffe über eine
 * passwortgeschützte Server-Funktion leitet. Der Browser hat keinen direkten
 * Datenbankzugriff mehr.
 */
class Query implements PromiseLike<Ergebnis> {
  constructor(private op: DbOp) {}

  select(columns?: string) {
    if (this.op.action === "select") this.op.columns = columns ?? "*";
    else this.op.returning = columns ?? "*";
    return this;
  }

  eq(column: string, value: string | number | boolean | null) {
    this.op.filters = [...(this.op.filters ?? []), { column, value }];
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.op.order = { column, ascending: options?.ascending ?? true };
    return this;
  }

  single() {
    this.op.single = true;
    return this;
  }

  then<T1 = Ergebnis, T2 = never>(
    onfulfilled?: ((value: Ergebnis) => T1 | PromiseLike<T1>) | null,
    onrejected?: ((reason: unknown) => T2 | PromiseLike<T2>) | null,
  ): PromiseLike<T1 | T2> {
    return dbRequest({ data: this.op })
      .then((r) => r as Ergebnis)
      .catch((e: unknown) => ({
        data: null,
        error: { message: e instanceof Error ? e.message : "Unbekannter Fehler" },
      }))
      .then(onfulfilled, onrejected);
  }
}

export const db = {
  from(table: Tabelle) {
    return {
      select: (columns?: string) =>
        new Query({ table, action: "select", columns: columns ?? "*" }),
      insert: (values: any) => new Query({ table, action: "insert", values }),
      update: (values: any) => new Query({ table, action: "update", values }),
      delete: () => new Query({ table, action: "delete" }),
    };
  },
};