import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Receipt, Package, ClipboardList, TrendingUp, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { db } from "@/lib/db";
import { pruefungSetzen } from "@/lib/pruefung";
import { rechnungStandardSort } from "@/lib/sortierung";
import { RechnungDetail } from "@/components/RechnungDetail";
import { ProduktDetail } from "@/components/ProduktDetail";
import { abweichungProzent, trendLabel, trendTone } from "@/lib/preise";
import { preisalarmSchwelleLaden } from "@/lib/einstellungen";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Checkbox,
  Empty,
  KpiCard,
  PageHeader,
  Table,
  Td,
  Tr,
} from "@/components/ui-kit";
import {
  datum,
  eur,
  heutigerMonat,
  monatKurz,
  monatLabel,
  monatVerschieben,
  num,
} from "@/lib/format";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — QUNO x CM Inventur" },
      { name: "description", content: "Überblick über Rechnungen, Bestände und Inventur." },
      { property: "og:title", content: "Dashboard — QUNO x CM Inventur" },
      { property: "og:description", content: "Überblick über Rechnungen, Bestände und Inventur." },
    ],
  }),
  component: Dashboard,
});

type PreisProdukt = {
  id: string;
  name: string;
  einheit: string;
  aktueller_bestand: number | string;
  letzter_ek: number | string | null;
  letzter_ek_datum: string | null;
  durchschnitt_ek: number | string | null;
  kategorien?: { name: string; farbe: string } | null;
  lieferanten?: { name: string | null } | null;
};

function Dashboard() {
  const qc = useQueryClient();
  const [auswahl, setAuswahl] = useState<string[]>([]);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [produktId, setProduktId] = useState<string | null>(null);

  const schwelle = useQuery({
    queryKey: ["preisalarm-schwelle"],
    queryFn: preisalarmSchwelleLaden,
  });

  const preisProdukte = useQuery({
    queryKey: ["preisalarm-produkte"],
    queryFn: async () => {
      const { data, error } = await db
        .from("produkte")
        .select("*, kategorien(name, farbe), lieferanten(*)")
        .order("name");
      if (error) throw error;
      return data as unknown as PreisProdukt[];
    },
  });

  const pruefen = useMutation({
    mutationFn: async (ids: string[]) => pruefungSetzen(ids, true),
    onSuccess: () => {
      toast.success("Als geprüft markiert");
      setAuswahl([]);
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["rechnungen"] });
    },
    onError: (e: Error) => toast.error(`Fehler: ${e.message}`),
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [rechnungen, produkte, zaehlungen] = await Promise.all([
        db.from("rechnungen").select("*, lieferanten(name)").order("datum", { ascending: false }),
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

  const aktMonat = heutigerMonat();
  const vorMonat = monatVerschieben(aktMonat, -1);
  const summeMonat = (m: string) =>
    (data?.rechnungen ?? [])
      .filter((r) => (r.datum ?? "").slice(0, 7) === m)
      .reduce((s, r) => s + Number(r.gesamtbetrag), 0);
  const wareneinsatz = summeMonat(aktMonat);
  const vorSumme = summeMonat(vorMonat);
  const veraenderung =
    vorSumme > 0
      ? (() => {
          const p = ((wareneinsatz - vorSumme) / vorSumme) * 100;
          return {
            text: `${p >= 0 ? "+" : "−"}${num(Math.abs(p), 1)} % vs. ${monatKurz(vorMonat)}`,
            klasse: p >= 0 ? "text-primary" : "text-success",
          };
        })()
      : { text: "Kein Vormonatswert", klasse: undefined as string | undefined };

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
          label="Letzte Inventur"
          value={letzteZaehlung ? datum(letzteZaehlung.datum) : "–"}
          hint={letzteZaehlung?.kategorien?.name ?? "Noch keine Inventur"}
          icon={<ClipboardList size={16} />}
        />
        <KpiCard
          label={`Wareneinsatz ${monatLabel(aktMonat)}`}
          value={isLoading ? "…" : eur(wareneinsatz)}
          hint={veraenderung.text}
          hintClassName={veraenderung.klasse}
          icon={<TrendingUp size={16} />}
        />
      </div>

      <Card className="mt-6">
        <CardHeader title="Letzte Rechnungen" />
        {(data?.rechnungen ?? []).length === 0 ? (
          <Empty text="Noch keine Rechnungen erfasst." />
        ) : (
          <Table head={["Rechnungsnummer", "Lieferant", "Datum", "Betrag", "Status"]}>
            {(data?.rechnungen ?? [])
              .slice()
              .sort(rechnungStandardSort)
              .slice(0, 5)
              .map((r) => (
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
        {(data?.rechnungen ?? []).length > 5 && (
          <div className="border-t border-border px-5 py-3 text-center">
            <Link to="/rechnungen" search={{ pruefung: undefined }}>
              <Button variant="outline">Mehr in Rechnungen anzeigen</Button>
            </Link>
          </div>
        )}
      </Card>

      {(() => {
        const alle = data?.rechnungen ?? [];
        const geprueftAnzahl = alle.filter((r) => r.geprueft).length;
        const offen = alle
          .filter((r) => !r.geprueft)
          .slice()
          .sort(rechnungStandardSort);
        const offenAnzeige = offen.slice(0, 5);
        return (
          <Card className="mt-6">
            <CardHeader
              title="Rechnungsprüfung"
              action={
                <span className="text-xs text-muted-foreground">
                  {geprueftAnzahl} von {alle.length} geprüft
                </span>
              }
            />
            {alle.length === 0 ? (
              <Empty text="Noch keine Rechnungen erfasst." />
            ) : offen.length === 0 ? (
              <div className="flex items-center justify-center gap-2 px-5 py-10 text-sm text-success">
                <CheckCircle2 size={18} /> Alle Rechnungen sind geprüft
              </div>
            ) : (
              <>
                {auswahl.length > 0 && (
                  <div className="flex flex-col gap-2 border-b border-border px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-sm text-foreground">
                      {auswahl.length} {auswahl.length === 1 ? "Rechnung" : "Rechnungen"} ausgewählt
                    </span>
                    <Button disabled={pruefen.isPending} onClick={() => pruefen.mutate(auswahl)}>
                      Als geprüft markieren
                    </Button>
                  </div>
                )}
                <Table
                  head={[
                    {
                      label: "Auswahl",
                      node: (
                        <Checkbox
                          checked={auswahl.length > 0 && auswahl.length === offenAnzeige.length}
                          onChange={(v) => setAuswahl(v ? offenAnzeige.map((r) => r.id) : [])}
                        />
                      ),
                    },
                    "Rechnungsnummer",
                    "Lieferant",
                    "Datum",
                    "Betrag",
                    "Prüfung",
                  ]}
                >
                  {offenAnzeige.map((r) => (
                    <Tr key={r.id} onClick={() => setDetailId(r.id)}>
                      <Td>
                        <span onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={auswahl.includes(r.id)}
                            onChange={(v) =>
                              setAuswahl((a) => (v ? [...a, r.id] : a.filter((x) => x !== r.id)))
                            }
                          />
                        </span>
                      </Td>
                      <Td>{r.rechnungsnummer}</Td>
                      <Td>{r.lieferanten?.name ?? "–"}</Td>
                      <Td>{datum(r.datum)}</Td>
                      <Td>{eur(Number(r.gesamtbetrag))}</Td>
                      <Td>
                        <Badge tone="danger">nicht geprüft</Badge>
                      </Td>
                    </Tr>
                  ))}
                </Table>
                {offen.length > 5 && (
                  <div className="border-t border-border px-5 py-3 text-center">
                    <Link to="/rechnungen" search={{ pruefung: "false" }}>
                      <Button variant="outline">Mehr in Rechnungen anzeigen</Button>
                    </Link>
                  </div>
                )}
              </>
            )}
          </Card>
        );
      })()}

      {(() => {
        const grenze = schwelle.data ?? 10;
        const auffaellig = (preisProdukte.data ?? [])
          .map((p) => ({
            produkt: p,
            abw: abweichungProzent(
              p.letzter_ek == null ? null : Number(p.letzter_ek),
              p.durchschnitt_ek == null ? null : Number(p.durchschnitt_ek),
            ),
          }))
          .filter((e): e is { produkt: PreisProdukt; abw: number } =>
            e.abw !== null ? Math.abs(e.abw) > grenze : false,
          )
          .sort((a, b) => Math.abs(b.abw) - Math.abs(a.abw));
        const anzeige = auffaellig.slice(0, 5);
        return (
          <Card className="mt-6">
            <CardHeader title="Preisveränderungen" />
            {anzeige.length === 0 ? (
              <Empty text="Keine auffälligen Preisveränderungen" />
            ) : (
              <>
                <Table head={["Produkt", "Lieferant", "Ø EK", "Letzter EK", "Abweichung"]}>
                  {anzeige.map(({ produkt: p, abw }) => (
                    <Tr key={p.id} onClick={() => setProduktId(p.id)}>
                      <Td>{p.name}</Td>
                      <Td>{p.lieferanten?.name ?? "–"}</Td>
                      <Td>{eur(Number(p.durchschnitt_ek))}</Td>
                      <Td>{eur(Number(p.letzter_ek))}</Td>
                      <Td>
                        <Badge tone={trendTone(abw)}>{trendLabel(abw)}</Badge>
                      </Td>
                    </Tr>
                  ))}
                </Table>
                <div className="border-t border-border px-5 py-3 text-center">
                  <Link to="/produkte">
                    <Button variant="outline">Mehr in Produkte anzeigen</Button>
                  </Link>
                </div>
              </>
            )}
          </Card>
        );
      })()}

      <Card className="mt-6">
        <CardHeader title="Letzte Inventuren pro Kategorie" />
        {(data?.zaehlungen ?? []).length === 0 ? (
          <Empty text="Noch keine Inventuren vorhanden." />
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

      <RechnungDetail id={detailId} onClose={() => setDetailId(null)} />
      <ProduktDetail
        produkt={(preisProdukte.data ?? []).find((p) => p.id === produktId) ?? null}
        onClose={() => setProduktId(null)}
      />
    </div>
  );
}
