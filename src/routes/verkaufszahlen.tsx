import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { db } from "@/lib/db";
import {
  Button,
  Card,
  Empty,
  Field,
  Input,
  PageHeader,
  Select,
  Table,
  Td,
  Tr,
} from "@/components/ui-kit";
import { eur, heutigerMonat, monatLabel, num } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/verkaufszahlen")({
  head: () => ({
    meta: [
      { title: "Verkaufszahlen — QUNO x CM Inventur" },
      { name: "description", content: "Monatliche Verkaufsmengen und Umsätze pro Produkt." },
      { property: "og:title", content: "Verkaufszahlen — QUNO x CM Inventur" },
      { property: "og:description", content: "Monatliche Verkaufsmengen und Umsätze pro Produkt." },
    ],
  }),
  component: VerkaufszahlenPage,
});

function VerkaufszahlenPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"uebersicht" | "eintragen">("uebersicht");
  const [filterMonat, setFilterMonat] = useState("");
  const [form, setForm] = useState({
    produkt_id: "",
    monat: heutigerMonat(),
    verkaufte_menge: "0",
    umsatz: "0",
  });

  const produkte = useQuery({
    queryKey: ["produkte-simple"],
    queryFn: async () => {
      const { data, error } = await db.from("produkte").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const zahlen = useQuery({
    queryKey: ["verkaufszahlen"],
    queryFn: async () => {
      const { data, error } = await db
        .from("verkaufszahlen")
        .select("*, produkte(name)")
        .order("monat", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const speichern = useMutation({
    mutationFn: async () => {
      if (!form.produkt_id) throw new Error("Bitte ein Produkt wählen");
      const { error } = await db.from("verkaufszahlen").insert({
        produkt_id: form.produkt_id,
        monat: form.monat,
        verkaufte_menge: Number(form.verkaufte_menge) || 0,
        umsatz: Number(form.umsatz) || 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Verkaufszahlen gespeichert");
      setForm({ ...form, verkaufte_menge: "0", umsatz: "0" });
      qc.invalidateQueries({ queryKey: ["verkaufszahlen"] });
      setTab("uebersicht");
    },
    onError: (e: Error) => toast.error(`Fehler: ${e.message}`),
  });

  const liste = (zahlen.data ?? []).filter((z) => !filterMonat || z.monat === filterMonat);

  return (
    <div>
      <PageHeader title="Verkaufszahlen" subtitle="Mengen und Umsätze pro Monat" />

      <div className="mb-5 inline-flex rounded-lg border border-border bg-surface-2 p-1">
        {(
          [
            ["uebersicht", "Übersicht"],
            ["eintragen", "Eintragen"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
              tab === key ? "bg-primary text-primary-foreground" : "text-muted-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "uebersicht" ? (
        <>
          <div className="mb-4 w-52">
            <Input
              type="month"
              value={filterMonat}
              onChange={(e) => setFilterMonat(e.target.value)}
            />
          </div>
          <Card>
            {zahlen.error ? (
              <Empty text={`Fehler: ${zahlen.error.message}`} />
            ) : liste.length === 0 ? (
              <Empty text="Keine Verkaufszahlen erfasst." />
            ) : (
              <Table head={["Produkt", "Monat", "Verkaufte Menge", "Umsatz"]}>
                {liste.map((z) => (
                  <Tr key={z.id}>
                    <Td>{z.produkte?.name ?? "–"}</Td>
                    <Td>{monatLabel(z.monat)}</Td>
                    <Td>{num(Number(z.verkaufte_menge))}</Td>
                    <Td>{eur(Number(z.umsatz))}</Td>
                  </Tr>
                ))}
              </Table>
            )}
          </Card>
        </>
      ) : (
        <Card className="max-w-lg p-5">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              speichern.mutate();
            }}
          >
            <Field label="Produkt">
              <Select
                value={form.produkt_id}
                onChange={(e) => setForm({ ...form, produkt_id: e.target.value })}
              >
                <option value="">– bitte wählen –</option>
                {(produkte.data ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Monat">
              <Input
                type="month"
                value={form.monat}
                onChange={(e) => setForm({ ...form, monat: e.target.value })}
              />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Verkaufte Menge">
                <Input
                  type="number"
                  step="any"
                  value={form.verkaufte_menge}
                  onChange={(e) => setForm({ ...form, verkaufte_menge: e.target.value })}
                />
              </Field>
              <Field label="Umsatz (€)">
                <Input
                  type="number"
                  step="any"
                  value={form.umsatz}
                  onChange={(e) => setForm({ ...form, umsatz: e.target.value })}
                />
              </Field>
            </div>
            <Button type="submit" disabled={speichern.isPending}>
              Speichern
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
}