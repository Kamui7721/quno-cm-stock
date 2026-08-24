import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { db } from "@/lib/db";
import {
  Badge,
  Button,
  Card,
  Empty,
  Input,
  PageHeader,
  Table,
  Td,
  Tr,
} from "@/components/ui-kit";
import { datum, einheitLabel, num } from "@/lib/format";

export const Route = createFileRoute("/zaehlung/$zaehlungId")({
  head: () => ({
    meta: [
      { title: "Zählung erfassen — QUNO x CM Inventur" },
      { name: "description", content: "Bestände einer Kategorie zählen und Differenzen berechnen." },
      { property: "og:title", content: "Zählung erfassen — QUNO x CM Inventur" },
      {
        property: "og:description",
        content: "Bestände einer Kategorie zählen und Differenzen berechnen.",
      },
    ],
  }),
  component: ZaehlungDetail,
});

function ZaehlungDetail() {
  const { zaehlungId } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [werte, setWerte] = useState<Record<string, string>>({});

  const zaehlung = useQuery({
    queryKey: ["zaehlung", zaehlungId],
    queryFn: async () => {
      const { data, error } = await db
        .from("zaehlungen")
        .select("*, kategorien(name, farbe)")
        .eq("id", zaehlungId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const kategorieId = zaehlung.data?.kategorie_id ?? null;

  const produkte = useQuery({
    queryKey: ["zaehlung-produkte", kategorieId],
    enabled: !!kategorieId,
    queryFn: async () => {
      const { data, error } = await db
        .from("produkte")
        .select("*")
        .eq("kategorie_id", kategorieId!)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const positionen = useQuery({
    queryKey: ["zaehlung-positionen", zaehlungId],
    queryFn: async () => {
      const { data, error } = await db
        .from("zaehlungspositionen")
        .select("*, produkte(name, einheit)")
        .eq("zaehlung_id", zaehlungId);
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (produkte.data) {
      setWerte((prev) => {
        const next = { ...prev };
        for (const p of produkte.data) if (!(p.id in next)) next[p.id] = "";
        return next;
      });
    }
  }, [produkte.data]);

  const abschliessen = useMutation({
    mutationFn: async () => {
      const rows = (produkte.data ?? []).map((p) => {
        const ist = Number(werte[p.id] ?? 0) || 0;
        const soll = Number(p.aktueller_bestand) || 0;
        const differenz = ist - soll;
        return {
          zaehlung_id: zaehlungId,
          produkt_id: p.id,
          ist_bestand: ist,
          soll_bestand: soll,
          differenz,
          differenz_prozent: soll === 0 ? 0 : (differenz / soll) * 100,
        };
      });
      const del = await db
        .from("zaehlungspositionen")
        .delete()
        .eq("zaehlung_id", zaehlungId);
      if (del.error) throw del.error;
      if (rows.length) {
        const ins = await db.from("zaehlungspositionen").insert(rows);
        if (ins.error) throw ins.error;
      }
      const upd = await db
        .from("zaehlungen")
        .update({ status: "abgeschlossen", abgeschlossen_am: new Date().toISOString() })
        .eq("id", zaehlungId);
      if (upd.error) throw upd.error;
    },
    onSuccess: () => {
      toast.success("Zählung abgeschlossen");
      qc.invalidateQueries({ queryKey: ["zaehlung", zaehlungId] });
      qc.invalidateQueries({ queryKey: ["zaehlung-positionen", zaehlungId] });
      qc.invalidateQueries({ queryKey: ["zaehlungen"] });
      navigate({ to: "/zaehlung" });
    },
    onError: (e: Error) => toast.error(`Fehler: ${e.message}`),
  });

  const abgeschlossen = zaehlung.data?.status === "abgeschlossen";

  if (zaehlung.error) {
    return <p className="text-sm text-primary">Fehler: {zaehlung.error.message}</p>;
  }

  return (
    <div>
      <Link
        to="/zaehlung"
        className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={14} /> Zurück zur Übersicht
      </Link>

      <PageHeader
        title={zaehlung.data?.kategorien?.name ?? "Zählung"}
        subtitle={zaehlung.data ? `Zählung vom ${datum(zaehlung.data.datum)}` : undefined}
        action={
          zaehlung.data ? (
            <Badge tone={abgeschlossen ? "success" : "warning"}>{zaehlung.data.status}</Badge>
          ) : undefined
        }
      />

      {abgeschlossen ? (
        <Card>
          {(positionen.data ?? []).length === 0 ? (
            <Empty text="Keine Positionen erfasst." />
          ) : (
            <Table head={["Produkt", "IST", "SOLL", "Differenz", "Differenz %"]}>
              {(positionen.data ?? []).map((p) => (
                <Tr key={p.id}>
                  <Td>{p.produkte?.name ?? "–"}</Td>
                  <Td>{num(Number(p.ist_bestand))}</Td>
                  <Td>{num(Number(p.soll_bestand))}</Td>
                  <Td>{num(Number(p.differenz))}</Td>
                  <Td>
                    <Badge tone={Number(p.differenz) < 0 ? "danger" : "success"}>
                      {num(Number(p.differenz_prozent), 1)} %
                    </Badge>
                  </Td>
                </Tr>
              ))}
            </Table>
          )}
        </Card>
      ) : (
        <>
          {/* Mobile: große Karten pro Produkt */}
          <div className="space-y-3 md:hidden">
            {(produkte.data ?? []).length === 0 ? (
              <Card>
                <Empty text="Keine Produkte in dieser Kategorie." />
              </Card>
            ) : (
              (produkte.data ?? []).map((p) => (
                <Card key={p.id} className="p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate text-base font-semibold text-foreground">
                      {p.name}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      Soll {num(Number(p.aktueller_bestand))} {einheitLabel(p.einheit)}
                    </span>
                  </div>
                  <Input
                    type="number"
                    step="any"
                    inputMode="decimal"
                    className="mt-3 h-[60px] text-center text-2xl font-semibold"
                    placeholder="0"
                    value={werte[p.id] ?? ""}
                    onChange={(e) => setWerte({ ...werte, [p.id]: e.target.value })}
                  />
                </Card>
              ))
            )}
          </div>

          <Card className="hidden md:block">
            {(produkte.data ?? []).length === 0 ? (
              <Empty text="Keine Produkte in dieser Kategorie." />
            ) : (
              <Table head={["Produkt", "Soll-Bestand", "Gezählt"]}>
                {(produkte.data ?? []).map((p) => (
                  <Tr key={p.id}>
                    <Td>{p.name}</Td>
                    <Td className="text-muted-foreground">
                      {num(Number(p.aktueller_bestand))} {einheitLabel(p.einheit)}
                    </Td>
                    <Td>
                      <Input
                        type="number"
                        step="any"
                        inputMode="decimal"
                        className="w-32"
                        placeholder="0"
                        value={werte[p.id] ?? ""}
                        onChange={(e) => setWerte({ ...werte, [p.id]: e.target.value })}
                      />
                    </Td>
                  </Tr>
                ))}
              </Table>
            )}
          </Card>
          <div className="sticky bottom-0 z-20 -mx-4 mt-5 border-t border-border bg-background/95 px-4 py-3 backdrop-blur md:static md:mx-0 md:flex md:justify-end md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
            <Button
              onClick={() => abschliessen.mutate()}
              disabled={abschliessen.isPending || (produkte.data ?? []).length === 0}
              className="h-14 w-full text-base md:h-auto md:w-auto md:text-sm"
            >
              Zählung abschließen
            </Button>
          </div>
        </>
      )}
    </div>
  );
}