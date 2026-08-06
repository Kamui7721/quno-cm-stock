import type { DbOp, TABELLEN } from "./db-schema";
import { dbRequest } from "./db.functions";

type Tabelle = (typeof TABELLEN)[number];

type Ergebnis<T> = { data: T; error: { message: string } | null };

/**
 * Kleiner Supabase-ähnlicher Query-Builder, der alle Datenzugriffe über eine
 * passwortgeschützte Server-Funktion leitet. Der Browser hat keinen direkten
 * Datenbankzugriff mehr.
 */
class Query<T = any[]> implements PromiseLike<Ergebnis<T>> {
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

  single(): Query<any> {
    this.op.single = true;
    return this as unknown as Query<any>;
  }

  then<T1 = Ergebnis<T>, T2 = never>(
    onfulfilled?: ((value: Ergebnis<T>) => T1 | PromiseLike<T1>) | null,
    onrejected?: ((reason: unknown) => T2 | PromiseLike<T2>) | null,
  ): PromiseLike<T1 | T2> {
    return dbRequest({ data: this.op })
      .then((r) => r as unknown as Ergebnis<T>)
      .catch((e: unknown) => ({
        data: null as unknown as T,
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