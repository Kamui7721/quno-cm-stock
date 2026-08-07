import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { db } from "@/lib/db";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Empty,
  PageHeader,
  Table,
  Td,
  Tr,
} from "@/components/ui-kit";
import { datum, heutigerMonat, monatLabel, num } from "@/lib/format";

export const Route = createFileRoute("/zaehlung/")({
  head: () => ({
    meta: [
      { title: "Zählung — QUNO x CM Inventur" },
      { name: "description", content: "Inventurzählungen pro Kategorie starten und auswerten." },
      { property: "og:title", content: "Zählung — QUNO x CM Inventur" },
      { property: "og:description", content: "Inventurzählungen pro Kategorie starten und auswerten." },
    ],
  }),
  component: ZaehlungUebersicht,
});

function ZaehlungUebersicht() {
  const qc = useQueryClient();
  const navigate = useNavigate();

  const kategorien = useQuery({
    queryKey: ["kategorien"],
    queryFn: async () => {
      const { data, error } = await db.from("kategorien").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const zaehlungen = useQuery({
    queryKey: ["zaehlungen"],
    queryFn: async () => {
      const { data, error } = await db
        .from("zaehlungen")
        .select("*, kategorien(name, farbe), zaehlungspositionen(differenz_prozent)")
        .order("datum", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const neueZaehlung = useMutation({
    mutationFn: async (kategorieId: string) => {
      const offen = (zaehlungen.data ?? []).find(
        (z) => z.kategorie_id === kategorieId && z.status === "offen",
      );
      if (offen) return offen.id;
      const { data, error } = await db
        .from("zaehlungen")
        .insert({ kategorie_id: kategorieId, monat: heutigerMonat(), status: "offen" })
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["zaehlungen"] });
      navigate({ to: "/zaehlung/$zaehlungId", params: { zaehlungId: id } });
    },
    onError: (e: Error) => toast.error(`Fehler: ${e.message}`),
  });

  const avg = (positionen: { differenz_prozent: number }[]) =>
    positionen.length
      ? positionen.reduce((s, p) => s + Number(p.differenz_prozent), 0) / positionen.length
      : 0;

  const monate = [...new Set((zaehlungen.data ?? []).map((z) => z.monat))];

  return (
    <div>
      <PageHeader title="Zählung" subtitle="Inventur pro Kategorie" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {(kategorien.data ?? []).map((k) => {
          const letzte = (zaehlungen.data ?? []).find((z) => z.kategorie_id === k.id);
          return (
            <Card key={k.id} className="p-5">
              <div className="flex items-center justify-between">
                <Badge color={k.farbe}>{k.name}</Badge>
                {letzte && (
                  <Badge tone={letzte.status === "abgeschlossen" ? "success" : "warning"}>
                    {letzte.status}
                  </Badge>
                )}
              </div>
              <div className="mt-4 text-sm text-muted-foreground">
                Letzte Zählung:{" "}
                <span className="text-foreground">
                  {letzte ? datum(letzte.datum) : "noch keine"}
                </span>
              </div>
              <div className="mt-4 flex gap-2">
                <Button
                  className="px-3 py-1.5 text-xs"
                  onClick={() => neueZaehlung.mutate(k.id)}
                  disabled={neueZaehlung.isPending}
                >
                  <Plus size={14} /> Neue Zählung
                </Button>
                {letzte && (
                  <Button
                    variant="outline"
                    className="px-3 py-1.5 text-xs"
                    onClick={() =>
                      navigate({
                        to: "/zaehlung/$zaehlungId",
                        params: { zaehlungId: letzte.id },
                      })
                    }
                  >
                    Öffnen
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="mt-6">
        <CardHeader title="Zählungs-Historie" />
        {(zaehlungen.data ?? []).length === 0 ? (
          <Empty text="Noch keine Zählungen." />
        ) : (
          <div>
            {monate.map((m) => (
              <div key={m}>
                <div className="border-b border-border bg-surface-2 px-5 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {monatLabel(m)}
                </div>
                <Table head={["Kategorie", "Datum", "Status", "Ø Differenz"]}>
                  {(zaehlungen.data ?? [])
                    .filter((z) => z.monat === m)
                    .map((z) => (
                      <Tr
                        key={z.id}
                        onClick={() =>
                          navigate({ to: "/zaehlung/$zaehlungId", params: { zaehlungId: z.id } })
                        }
                      >
                        <Td>
                          <Badge color={z.kategorien?.farbe ?? undefined}>
                            {z.kategorien?.name ?? "–"}
                          </Badge>
                        </Td>
                        <Td>{datum(z.datum)}</Td>
                        <Td>
                          <Badge tone={z.status === "abgeschlossen" ? "success" : "warning"}>
                            {z.status}
                          </Badge>
                        </Td>
                        <Td>{num(avg(z.zaehlungspositionen ?? []), 1)} %</Td>
                      </Tr>
                    ))}
                </Table>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}