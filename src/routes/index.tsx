import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Receipt, Package, ClipboardList, Euro } from "lucide-react";
import { db } from "@/lib/db";
import { Badge, Card, CardHeader, Empty, KpiCard, PageHeader, Table, Td, Tr } from "@/components/ui-kit";
import { datum, eur, num } from "@/lib/format";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — QUNO x CM Inventur" },
      { name: "description", content: "Überblick über Rechnungen, Bestände und Zählungen." },
      { property: "og:title", content: "Dashboard — QUNO x CM Inventur" },
      { property: "og:description", content: "Überblick über Rechnungen, Bestände und Zählungen." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [rechnungen, produkte, zaehlungen] = await Promise.all([
        db
          .from("rechnungen")
          .select("*, lieferanten(name)")
          .order("datum", { ascending: false }),
        db.from("produkte").select("id"),
        db
          .from("zaehlungen")
          .select("*, kategorien(name, farbe), zaehlungspositionen(differenz_prozent)")
          .order("datum", { ascending: false }),
      ]);
      if (rechnungen.error) throw rechnungen.error;
      if (produkte.error) throw produkte.error;
      if (zaehlungen.error) throw zaehlungen.error;
      return {
        rechnungen: rechnungen.data,
        produkteAnzahl: produkte.data.length,
        zaehlungen: zaehlungen.data,
      };
    },
  });

  if (error) {
    return <p className="text-sm text-primary">Fehler beim Laden: {error.message}</p>;
  }

  const offene = (data?.rechnungen ?? []).filter((r) => !r.bezahlt);
  const offeneSumme = offene.reduce((s, r) => s + Number(r.gesamtbetrag), 0);
  const letzteZaehlung = data?.zaehlungen?.[0];

  const avg = (positionen: { differenz_prozent: number }[]) =>
    positionen.length
      ? positionen.reduce((s, p) => s + Number(p.differenz_prozent), 0) / positionen.length
      : 0;

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Überblick über deine Inventur" />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <KpiCard
          label="Offene Rechnungen"
          value={isLoading ? "…" : String(offene.length)}
          hint={eur(offeneSumme)}
          icon={<Receipt size={16} />}
        />
        <KpiCard
          label="Produkte im Inventar"
          value={isLoading ? "…" : String(data?.produkteAnzahl ?? 0)}
          icon={<Package size={16} />}
        />
        <KpiCard
          label="Letzte Zählung"
          value={letzteZaehlung ? datum(letzteZaehlung.datum) : "–"}
          hint={letzteZaehlung?.kategorien?.name ?? "Noch keine Zählung"}
          icon={<ClipboardList size={16} />}
        />
        <KpiCard
          label="Unbezahlte Rechnungen"
          value={eur(offeneSumme)}
          hint={`${offene.length} Rechnung(en)`}
          icon={<Euro size={16} />}
        />
      </div>

      <Card className="mt-6">
        <CardHeader title="Letzte Rechnungen" />
        {(data?.rechnungen ?? []).length === 0 ? (
          <Empty text="Noch keine Rechnungen erfasst." />
        ) : (
          <Table head={["Rechnungsnummer", "Lieferant", "Datum", "Betrag", "Status"]}>
            {(data?.rechnungen ?? []).slice(0, 5).map((r) => (
              <Tr key={r.id}>
                <Td>{r.rechnungsnummer}</Td>
                <Td>{r.lieferanten?.name ?? "–"}</Td>
                <Td>{datum(r.datum)}</Td>
                <Td>{eur(Number(r.gesamtbetrag))}</Td>
                <Td>
                  <Badge tone={r.bezahlt ? "success" : "danger"}>
                    {r.bezahlt ? "bezahlt" : "offen"}
                  </Badge>
                </Td>
              </Tr>
            ))}
          </Table>
        )}
      </Card>

      <Card className="mt-6">
        <CardHeader title="Letzte Zählungen pro Kategorie" />
        {(data?.zaehlungen ?? []).length === 0 ? (
          <Empty text="Noch keine Zählungen vorhanden." />
        ) : (
          <Table head={["Kategorie", "Datum", "Status", "Ø Differenz"]}>
            {(data?.zaehlungen ?? []).slice(0, 8).map((z) => (
              <Tr key={z.id}>
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
        )}
      </Card>
    </div>
  );
}
