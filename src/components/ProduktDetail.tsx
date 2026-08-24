import { type ReactNode, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Pencil, Trash2 } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { db } from "@/lib/db";
import { Badge, Button, DetailModal, InfoRow, Table, Td, Tr } from "@/components/ui-kit";
import { RechnungDetail } from "@/components/RechnungDetail";
import { datum, einheitLabel, eur, num } from "@/lib/format";
import {
  abweichungProzent,
  baueEinkaeufe,
  trendLabel,
  trendTone,
  vorZwoelfMonaten,
  type EinkaufRoh,
} from "@/lib/preise";

type Produkt = {
  id: string;
  name: string;
  einheit: string;
  aktueller_bestand: number | string;
  letzter_ek?: number | string | null;
  letzter_ek_datum?: string | null;
  durchschnitt_ek?: number | string | null;
  kategorien?: { name: string; farbe: string } | null;
  lieferanten?: { name: string | null } | null;
};

export function ProduktDetail({
  produkt,
  onClose,
  onEdit,
  onDelete,
  zusatz,
}: {
  produkt: Produkt | null | undefined;
  onClose: () => void;
  onEdit?: ((p: Produkt) => void) | undefined;
  onDelete?: ((id: string) => void) | undefined;
  zusatz?: ReactNode | undefined;
}) {
  const [rechnungId, setRechnungId] = useState<string | null>(null);
  const id = produkt?.id ?? null;

  const einkaeufeQuery = useQuery({
    queryKey: ["produkt-einkaeufe", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await db
        .from("rechnungspositionen")
        .select("*, rechnungen(datum, rechnungsnummer, lieferanten(name))")
        .eq("produkt_id", id!);
      if (error) throw error;
      return data as EinkaufRoh[];
    },
  });

  const einkaeufe = useMemo(() => baueEinkaeufe(einkaeufeQuery.data ?? []), [einkaeufeQuery.data]);

  const gueltige = einkaeufe.filter((e) => !e.ausreisser && e.einzelpreis !== null);
  const grenze = vorZwoelfMonaten();
  const letzten12 = gueltige.filter((e) => (e.datum ?? "") >= grenze);

  const letzterEk =
    produkt?.letzter_ek != null
      ? Number(produkt.letzter_ek)
      : (gueltige[gueltige.length - 1]?.einzelpreis ?? null);
  const durchschnitt =
    produkt?.durchschnitt_ek != null
      ? Number(produkt.durchschnitt_ek)
      : letzten12.length
        ? letzten12.reduce((s, e) => s + (e.einzelpreis ?? 0), 0) / letzten12.length
        : null;
  const aeltester = letzten12[0]?.einzelpreis ?? null;
  const veraenderung = abweichungProzent(letzterEk, aeltester);

  const chartDaten = gueltige.map((e) => ({
    datum: e.datum ? datum(e.datum) : "–",
    preis: Number((e.einzelpreis ?? 0).toFixed(2)),
  }));

  const nachLieferant = useMemo(() => {
    const m = new Map<string, { summe: number; anzahl: number }>();
    for (const e of gueltige) {
      const eintrag = m.get(e.lieferant) ?? { summe: 0, anzahl: 0 };
      eintrag.summe += e.einzelpreis ?? 0;
      eintrag.anzahl += 1;
      m.set(e.lieferant, eintrag);
    }
    return [...m.entries()]
      .map(([name, v]) => ({ name, schnitt: v.summe / v.anzahl, anzahl: v.anzahl }))
      .sort((a, b) => a.schnitt - b.schnitt);
  }, [gueltige]);

  return (
    <>
      <DetailModal
        open={!!produkt}
        onClose={onClose}
        title={produkt?.name ?? "Produkt"}
        action={
          produkt && onEdit ? (
            <button
              type="button"
              aria-label="Produkt bearbeiten"
              className="rounded-md p-1.5 text-muted-foreground transition hover:bg-surface-2 hover:text-foreground"
              onClick={() => onEdit(produkt)}
            >
              <Pencil size={16} />
            </button>
          ) : null
        }
        footer={
          produkt && onDelete ? (
            <Button variant="danger" className="w-full" onClick={() => onDelete(produkt.id)}>
              <Trash2 size={16} /> Produkt löschen
            </Button>
          ) : null
        }
      >
        {!produkt ? null : (
          <>
            <div>
              <InfoRow label="Name" value={produkt.name} />
              <InfoRow
                label="Kategorie"
                value={
                  produkt.kategorien ? (
                    <Badge color={produkt.kategorien.farbe}>{produkt.kategorien.name}</Badge>
                  ) : (
                    "–"
                  )
                }
              />
              <InfoRow label="Lieferant" value={produkt.lieferanten?.name ?? "–"} />
              <InfoRow label="Einheit" value={einheitLabel(produkt.einheit)} />
              <InfoRow
                label="Aktueller Bestand"
                value={`${num(Number(produkt.aktueller_bestand))} ${einheitLabel(produkt.einheit)}`}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Kennzahl
                label="Letzter EK"
                wert={letzterEk !== null ? eur(letzterEk) : "–"}
                hinweis={produkt.letzter_ek_datum ? datum(produkt.letzter_ek_datum) : undefined}
              />
              <Kennzahl
                label="Ø EK (12 Monate)"
                wert={durchschnitt !== null ? eur(durchschnitt) : "–"}
              />
              <Kennzahl
                label="Veränderung"
                wert={veraenderung !== null ? trendLabel(veraenderung) : "–"}
                klasse={
                  veraenderung === null
                    ? undefined
                    : veraenderung > 0
                      ? "text-primary"
                      : veraenderung < 0
                        ? "text-success"
                        : undefined
                }
              />
            </div>

            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Preisentwicklung
              </h3>
              {chartDaten.length < 2 ? (
                <p className="rounded-lg border border-border bg-surface-2 px-3 py-6 text-center text-sm text-muted-foreground">
                  Zu wenige Daten für eine Preisentwicklung
                </p>
              ) : (
                <div className="h-52 w-full rounded-lg border border-border bg-surface-2 p-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartDaten}>
                      <CartesianGrid stroke="#2a2d3e" vertical={false} />
                      <XAxis dataKey="datum" stroke="#8b90a5" fontSize={11} tickMargin={6} />
                      <YAxis stroke="#8b90a5" fontSize={11} width={52} />
                      <Tooltip
                        contentStyle={{
                          background: "#1e2130",
                          border: "1px solid #2a2d3e",
                          borderRadius: 8,
                          fontSize: 12,
                          color: "#fff",
                        }}
                        formatter={(v: number) => [eur(v), "Einzelpreis"]}
                      />
                      <Line
                        type="monotone"
                        dataKey="preis"
                        stroke="#e11d48"
                        strokeWidth={2}
                        dot={{ r: 3, fill: "#e11d48" }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {nachLieferant.length > 1 && (
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Preisvergleich nach Lieferant
                </h3>
                <div className="space-y-2">
                  {nachLieferant.map((l, i) => (
                    <div
                      key={l.name}
                      className={
                        "flex items-center justify-between rounded-lg border px-3 py-2 text-sm " +
                        (i === 0 ? "border-success/50 bg-success/10" : "border-border bg-surface-2")
                      }
                    >
                      <span className="font-medium text-foreground">
                        {l.name}
                        {i === 0 && (
                          <Badge tone="success" className="ml-2">
                            günstigster
                          </Badge>
                        )}
                      </span>
                      <span className="text-muted-foreground">
                        Ø {eur(l.schnitt)} · {l.anzahl} Einkäufe
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Einkäufe
              </h3>
              {einkaeufe.length === 0 ? (
                <p className="text-sm text-muted-foreground">Noch keine Einkäufe erfasst.</p>
              ) : (
                <div className="-mx-5 overflow-x-auto">
                  <Table
                    head={["Datum", "Lieferant", "Menge", "Einzelpreis", "Gesamt", "Rechnung"]}
                  >
                    {einkaeufe
                      .slice()
                      .reverse()
                      .map((e) => (
                        <Tr key={e.id} onClick={() => setRechnungId(e.rechnungId)}>
                          <Td>{datum(e.datum)}</Td>
                          <Td>{e.lieferant}</Td>
                          <Td>{num(e.menge)}</Td>
                          <Td>
                            <span className="inline-flex items-center gap-1">
                              {e.einzelpreis !== null ? eur(e.einzelpreis) : "–"}
                              {e.ausreisser && (
                                <span
                                  title="Möglicher Extraktionsfehler — von der Berechnung ausgeschlossen"
                                  className="text-warning"
                                >
                                  <AlertTriangle size={14} />
                                </span>
                              )}
                            </span>
                          </Td>
                          <Td>{eur(e.gesamtpreis)}</Td>
                          <Td>{e.rechnungsnummer}</Td>
                        </Tr>
                      ))}
                  </Table>
                </div>
              )}
            </div>

            {zusatz}
          </>
        )}
      </DetailModal>

      <RechnungDetail id={rechnungId} onClose={() => setRechnungId(null)} />
    </>
  );
}

function Kennzahl({
  label,
  wert,
  hinweis,
  klasse,
}: {
  label: string;
  wert: string;
  hinweis?: string | undefined;
  klasse?: string | undefined;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface-2 p-3">
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className={"mt-1 text-base font-semibold text-foreground " + (klasse ?? "")}>{wert}</div>
      {hinweis && <div className="mt-0.5 text-[11px] text-muted-foreground">{hinweis}</div>}
    </div>
  );
}

