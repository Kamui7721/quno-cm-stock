import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AlertTriangle, FileText, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { db } from "@/lib/db";
import { belegPfad, belegUrlHolen } from "@/lib/beleg";

import { pruefungSetzen } from "@/lib/pruefung";
import { rechnungStandardSort } from "@/lib/sortierung";
import { RechnungDetail } from "@/components/RechnungDetail";
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Empty,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Table,
  Td,
  Tr,
} from "@/components/ui-kit";
import { datum, eur } from "@/lib/format";
import { EINHEITEN } from "@/lib/types";

export const Route = createFileRoute("/rechnungen")({
  head: () => ({
    meta: [
      { title: "Rechnungen — QUNO x CM Inventur" },
      { name: "description", content: "Eingangsrechnungen mit Positionen und Zahlungsstatus." },
      { property: "og:title", content: "Rechnungen — QUNO x CM Inventur" },
      {
        property: "og:description",
        content: "Eingangsrechnungen mit Positionen und Zahlungsstatus.",
      },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    pruefung:
      search["pruefung"] === "false" || search["pruefung"] === "true"
        ? String(search["pruefung"])
        : undefined,
  }),
  component: RechnungenPage,
});

type PosForm = {
  bezeichnung: string;
  kategorie_id: string;
  produkt_id: string;
  einheit: string;
  menge: string;
  einzelpreis: string;
  preis: string;
  preisManuell: boolean;
};

const leerePos = (): PosForm => ({
  bezeichnung: "",
  kategorie_id: "",
  produkt_id: "",
  einheit: "stück",
  menge: "1",
  einzelpreis: "",
  preis: "0",
  preisManuell: false,
});

/** Berechnet den Gesamtpreis einer Position neu, solange er nicht manuell überschrieben wurde. */
const posBerechnen = (p: PosForm): PosForm => {
  if (p.preisManuell) return p;
  if (p.einzelpreis.trim() === "" || p.menge.trim() === "") return p;
  const wert = (Number(p.einzelpreis) || 0) * (Number(p.menge) || 0);
  return { ...p, preis: String(Number(wert.toFixed(4))) };
};


function RechnungenPage() {
  const qc = useQueryClient();
  const [modal, setModal] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [filterLieferant, setFilterLieferant] = useState("");
  const [filterMonat, setFilterMonat] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const suche = Route.useSearch();
  const [filterPruefung, setFilterPruefung] = useState(suche.pruefung ?? "");
  const [filterBeleg, setFilterBeleg] = useState("");

  const [auswahl, setAuswahl] = useState<string[]>([]);
  const [sortSpalte, setSortSpalte] = useState<
    "rechnungsnummer" | "lieferant" | "datum" | "gesamtbetrag" | "erstellt_am"
  >("erstellt_am");
  const [sortRichtung, setSortRichtung] = useState<"asc" | "desc">("desc");
  const [kopf, setKopf] = useState({
    rechnungsnummer: "",
    lieferant_id: "",
    datum: new Date().toISOString().slice(0, 10),
  });
  const [positionen, setPositionen] = useState<PosForm[]>([leerePos()]);
  const [belegDatei, setBelegDatei] = useState<File | null>(null);
  const [dragAktiv, setDragAktiv] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    rechnungsnummer: "",
    lieferant_id: "",
    datum: "",
    gesamtbetrag: "0",
    bezahlt: false,
  });
  const [notizEdit, setNotizEdit] = useState<{ id: string; wert: string } | null>(null);

  const lieferanten = useQuery({
    queryKey: ["lieferanten"],
    queryFn: async () => {
      const { data, error } = await db.from("lieferanten").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });
  const kategorien = useQuery({
    queryKey: ["kategorien"],
    queryFn: async () => {
      const { data, error } = await db.from("kategorien").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });
  const produkte = useQuery({
    queryKey: ["produkte-simple"],
    queryFn: async () => {
      const { data, error } = await db.from("produkte").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });
  const rechnungen = useQuery({
    queryKey: ["rechnungen"],
    queryFn: async () => {
      const { data, error } = await db
        .from("rechnungen")
        .select("*, lieferanten(name)")
        .order("erstellt_am", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const pruefen = useMutation({
    mutationFn: async ({ ids, geprueft }: { ids: string[]; geprueft: boolean }) =>
      pruefungSetzen(ids, geprueft),
    onSuccess: (_d, v) => {
      toast.success(v.geprueft ? "Als geprüft markiert" : "Prüfung zurückgesetzt");
      setAuswahl([]);
      qc.invalidateQueries({ queryKey: ["rechnungen"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error(`Fehler: ${e.message}`),
  });

  const gesamt = positionen.reduce((s, p) => s + (Number(p.preis) || 0), 0);


  const anlegen = useMutation({
    mutationFn: async () => {
      const { data, error } = await db
        .from("rechnungen")
        .insert({
          rechnungsnummer: kopf.rechnungsnummer,
          lieferant_id: kopf.lieferant_id || null,
          datum: kopf.datum,
          gesamtbetrag: gesamt,
        })
        .select("id")
        .single();
      if (error) throw error;
      const rows = positionen
        .filter((p) => p.bezeichnung.trim())
        .map((p) => ({
          rechnung_id: data.id,
          bezeichnung: p.bezeichnung,
          kategorie_id: p.kategorie_id || null,
          produkt_id: p.produkt_id || null,
          einheit: p.einheit || "stück",
          menge: Number(p.menge) || 0,
          einzelpreis: p.einzelpreis.trim() === "" ? null : Number(p.einzelpreis) || 0,
          preis: Number(p.preis) || 0,

        }));
      if (rows.length) {
        const res = await db.from("rechnungspositionen").insert(rows);
        if (res.error) throw res.error;
      }
    },
    onSuccess: () => {
      toast.success("Rechnung gespeichert");
      setModal(false);
      setKopf({
        rechnungsnummer: "",
        lieferant_id: "",
        datum: new Date().toISOString().slice(0, 10),
      });
      setPositionen([leerePos()]);
      qc.invalidateQueries({ queryKey: ["rechnungen"] });
    },
    onError: (e: Error) => toast.error(`Fehler: ${e.message}`),
  });

  const statusToggle = useMutation({
    mutationFn: async ({ id, bezahlt }: { id: string; bezahlt: boolean }) => {
      const { error } = await db.from("rechnungen").update({ bezahlt }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rechnungen"] }),
    onError: (e: Error) => toast.error(`Fehler: ${e.message}`),
  });

  const speichern = useMutation({
    mutationFn: async () => {
      const { error } = await db
        .from("rechnungen")
        .update({
          rechnungsnummer: editForm.rechnungsnummer,
          lieferant_id: editForm.lieferant_id || null,
          datum: editForm.datum,
          gesamtbetrag: Number(editForm.gesamtbetrag) || 0,
          bezahlt: editForm.bezahlt,
        })
        .eq("id", editId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Rechnung aktualisiert");
      setEditId(null);
      qc.invalidateQueries({ queryKey: ["rechnungen"] });
    },
    onError: (e: Error) => toast.error(`Fehler: ${e.message}`),
  });
  const notizSpeichern = useMutation({
    mutationFn: async ({ id, notizen }: { id: string; notizen: string }) => {
      const { error } = await db.from("rechnungen").update({ notizen: notizen || null }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Notiz gespeichert");
      setNotizEdit(null);
      qc.invalidateQueries({ queryKey: ["rechnungen"] });
    },
    onError: (e: Error) => toast.error(`Fehler: ${e.message}`),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bearbeiten = (r: any) => {
    setEditForm({
      rechnungsnummer: r.rechnungsnummer ?? "",
      lieferant_id: r.lieferant_id ?? "",
      datum: r.datum ?? "",
      gesamtbetrag: String(r.gesamtbetrag ?? 0),
      bezahlt: !!r.bezahlt,
    });
    setEditId(r.id);
  };

  const sortieren = (spalte: typeof sortSpalte) => {
    if (sortSpalte === spalte) {
      setSortRichtung(sortRichtung === "asc" ? "desc" : "asc");
    } else {
      setSortSpalte(spalte);
      setSortRichtung("asc");
    }
  };
  const kopfZelle = (label: string, spalte: typeof sortSpalte) => ({
    label,
    onClick: () => sortieren(spalte),
    dir: sortSpalte === spalte ? sortRichtung : null,
  });

  const liste = (rechnungen.data ?? [])
    .filter(
      (r) =>
        (!filterLieferant || r.lieferant_id === filterLieferant) &&
        (!filterMonat || r.datum.slice(0, 7) === filterMonat) &&
        (!filterStatus || String(r.bezahlt) === filterStatus) &&
        (!filterPruefung || String(!!r.geprueft) === filterPruefung) &&
        (!filterBeleg || String(!!belegPfad(r.pdf_url)) === filterBeleg),

    )
    .slice()
    .sort((a, b) => {
      const f = sortRichtung === "asc" ? 1 : -1;
      if (sortSpalte === "erstellt_am") return rechnungStandardSort(a, b) * (f === 1 ? -1 : 1);
      if (sortSpalte === "gesamtbetrag")
        return (Number(a.gesamtbetrag) - Number(b.gesamtbetrag)) * f;
      const wert = (r: typeof a) =>
        sortSpalte === "lieferant"
          ? (r.lieferanten?.name ?? "")
          : sortSpalte === "datum"
            ? r.datum
            : r.rechnungsnummer;
      return String(wert(a)).localeCompare(String(wert(b)), "de", { numeric: true }) * f;
    });


  return (
    <div>
      <PageHeader
        title="Rechnungen"
        subtitle="Eingangsrechnungen und Zahlungsstatus"
        action={
          <Button onClick={() => setModal(true)}>
            <Plus size={16} /> Rechnung manuell hinzufügen
          </Button>
        }
      />

      <div className="mb-4 grid max-w-4xl grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Select value={filterLieferant} onChange={(e) => setFilterLieferant(e.target.value)}>
          <option value="">Alle Lieferanten</option>
          {(lieferanten.data ?? []).map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </Select>
        <Input type="month" value={filterMonat} onChange={(e) => setFilterMonat(e.target.value)} />
        <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">Alle Status</option>
          <option value="true">Bezahlt</option>
          <option value="false">Offen</option>
        </Select>
        <Select value={filterPruefung} onChange={(e) => setFilterPruefung(e.target.value)}>
          <option value="">Alle Prüfungen</option>
          <option value="true">Geprüft</option>
          <option value="false">Nicht geprüft</option>
        </Select>
        <Select value={filterBeleg} onChange={(e) => setFilterBeleg(e.target.value)}>
          <option value="">Alle Belege</option>
          <option value="true">Mit PDF</option>
          <option value="false">Ohne PDF</option>
        </Select>
      </div>


      {auswahl.length > 0 && (
        <div className="mb-4 flex flex-col gap-3 rounded-xl border border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm font-medium text-foreground">
            {auswahl.length} {auswahl.length === 1 ? "Rechnung" : "Rechnungen"} ausgewählt
          </span>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={pruefen.isPending}
              onClick={() => pruefen.mutate({ ids: auswahl, geprueft: true })}
            >
              Als geprüft markieren
            </Button>
            <Button
              variant="outline"
              disabled={pruefen.isPending}
              onClick={() => pruefen.mutate({ ids: auswahl, geprueft: false })}
            >
              Prüfung zurücksetzen
            </Button>
          </div>
        </div>
      )}

      <Card>
        {rechnungen.error ? (
          <Empty text={`Fehler: ${rechnungen.error.message}`} />
        ) : liste.length === 0 ? (
          <Empty text="Keine Rechnungen vorhanden." />
        ) : (
          <Table
            head={[
              {
                label: "Auswahl",
                node: (
                  <span onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={auswahl.length > 0 && auswahl.length === liste.length}
                      onChange={(v) => setAuswahl(v ? liste.map((r) => r.id) : [])}
                    />
                  </span>
                ),
              },
              kopfZelle("Rechnungsnummer", "rechnungsnummer"),
              kopfZelle("Lieferant", "lieferant"),
              kopfZelle("Datum", "datum"),
              kopfZelle("Betrag", "gesamtbetrag"),
              "Status",
              "Prüfung",
              "PDF",
              "Notizen",
            ]}
          >
            {liste.map((r) => (
            <Tr
              key={r.id}
              onClick={(e) => {
                if ((e.target as HTMLElement).closest("[data-note-cell]")) return;
                setDetailId(r.id);
              }}
            >
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
                  <span onClick={(e) => e.stopPropagation()}>
                    <Badge
                      tone={r.bezahlt ? "success" : "warning"}
                      onClick={() => statusToggle.mutate({ id: r.id, bezahlt: !r.bezahlt })}
                    >
                      {r.bezahlt ? "bezahlt" : "offen"}
                    </Badge>
                  </span>
                </Td>
                <Td>
                  <span className="flex items-center gap-1.5">
                    <Badge tone={r.geprueft ? "success" : "danger"}>
                      {r.geprueft ? "geprüft" : "nicht geprüft"}
                    </Badge>
                    {r.import_ok === false ? (
                      <span title={r.import_warnungen || "Import mit Warnungen"}>
                        <AlertTriangle size={14} className="shrink-0 text-warning" />
                      </span>
                    ) : null}
                  </span>
                </Td>
                <Td>
                  {belegPfad(r.pdf_url) ? (
                    <button
                      type="button"
                      aria-label="Beleg öffnen"
                      className="text-primary hover:opacity-80"
                      onClick={(e) => {
                        e.stopPropagation();
                        const tab = window.open("", "_blank");
                        belegUrlHolen(r.id)
                          .then((url) => {
                            if (tab) tab.location.href = url;
                            else window.open(url, "_blank", "noreferrer");
                          })
                          .catch((err: Error) => {
                            tab?.close();
                            toast.error(err.message);
                          });
                      }}
                    >
                      <FileText size={16} />
                    </button>

                  ) : (
                    <span className="text-muted-foreground">–</span>
                  )}
                </Td>
                <Td className="p-0">
                  <div
                    data-note-cell
                    className="h-full w-full px-5 py-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {notizEdit?.id === r.id ? (
                      <Input
                        autoFocus
                        value={notizEdit!.wert}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setNotizEdit({ ...notizEdit!, wert: e.target.value })}
                        onBlur={() => {
                          const wert = notizEdit!.wert.trim();
                          if (wert !== (r.notizen ?? "")) {
                            notizSpeichern.mutate({ id: r.id, notizen: wert });
                          } else {
                            setNotizEdit(null);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.currentTarget.blur();
                          } else if (e.key === "Escape") {
                            setNotizEdit(null);
                          }
                        }}
                        className="min-h-8 py-1 text-sm"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setNotizEdit({ id: r.id, wert: r.notizen ?? "" });
                        }}
                        className="block w-full truncate text-left text-sm text-foreground hover:text-primary"
                        title={r.notizen ?? undefined}
                      >
                        {r.notizen || <span className="text-muted-foreground">–</span>}
                      </button>
                    )}
                  </div>
                </Td>
              </Tr>
            ))}
          </Table>
        )}
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} title="Rechnung manuell hinzufügen" wide>
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            anlegen.mutate();
          }}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Rechnungsnummer">
              <Input
                required
                value={kopf.rechnungsnummer}
                onChange={(e) => setKopf({ ...kopf, rechnungsnummer: e.target.value })}
              />
            </Field>
            <Field label="Lieferant">
              <Select
                value={kopf.lieferant_id}
                onChange={(e) => setKopf({ ...kopf, lieferant_id: e.target.value })}
              >
                <option value="">–</option>
                {(lieferanten.data ?? []).map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Datum">
              <Input
                type="date"
                value={kopf.datum}
                onChange={(e) => setKopf({ ...kopf, datum: e.target.value })}
              />
            </Field>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Positionen
              </span>
              <Button
                type="button"
                variant="outline"
                className="px-3 py-1 text-xs"
                onClick={() => setPositionen([...positionen, leerePos()])}
              >
                <Plus size={14} /> Position
              </Button>
            </div>
            <div className="space-y-2">
              {positionen.map((p, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[2fr_1fr_1fr_1fr_70px_90px_90px_32px] items-center gap-2"
                >
                  <Input
                    placeholder="Bezeichnung"
                    value={p.bezeichnung}
                    onChange={(e) =>
                      setPositionen(
                        positionen.map((x, j) =>
                          j === i ? { ...x, bezeichnung: e.target.value } : x,
                        ),
                      )
                    }
                  />
                  <Select
                    value={p.kategorie_id}
                    onChange={(e) =>
                      setPositionen(
                        positionen.map((x, j) =>
                          j === i ? { ...x, kategorie_id: e.target.value } : x,
                        ),
                      )
                    }
                  >
                    <option value="">Kategorie</option>
                    {(kategorien.data ?? []).map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.name}
                      </option>
                    ))}
                  </Select>
                  <Select
                    value={p.produkt_id}
                    onChange={(e) =>
                      setPositionen(
                        positionen.map((x, j) =>
                          j === i ? { ...x, produkt_id: e.target.value } : x,
                        ),
                      )
                    }
                  >
                    <option value="">Produkt</option>
                    {(produkte.data ?? []).map((pr) => (
                      <option key={pr.id} value={pr.id}>
                        {pr.name}
                      </option>
                    ))}
                  </Select>
                  <Select
                    value={p.einheit}
                    onChange={(e) =>
                      setPositionen(
                        positionen.map((x, j) => (j === i ? { ...x, einheit: e.target.value } : x)),
                      )
                    }
                  >
                    {EINHEITEN.map((e2) => (
                      <option key={e2.wert} value={e2.wert}>
                        {e2.label}
                      </option>
                    ))}
                  </Select>
                  <Input
                    type="number"
                    step="any"
                    inputMode="decimal"
                    title="Menge"
                    placeholder="Menge"
                    value={p.menge}
                    onChange={(e) =>
                      setPositionen(
                        positionen.map((x, j) =>
                          j === i ? posBerechnen({ ...x, menge: e.target.value }) : x,
                        ),
                      )
                    }
                  />
                  <Input
                    type="number"
                    step="any"
                    inputMode="decimal"
                    title="Einzelpreis (optional)"
                    placeholder="Einzelpreis"
                    value={p.einzelpreis}
                    onChange={(e) =>
                      setPositionen(
                        positionen.map((x, j) =>
                          j === i ? posBerechnen({ ...x, einzelpreis: e.target.value }) : x,
                        ),
                      )
                    }
                  />
                  <Input
                    type="number"
                    step="any"
                    inputMode="decimal"
                    title="Gesamtpreis (überschreibbar)"
                    placeholder="Gesamt"
                    value={p.preis}
                    onChange={(e) =>
                      setPositionen(
                        positionen.map((x, j) =>
                          j === i ? { ...x, preis: e.target.value, preisManuell: true } : x,
                        ),
                      )
                    }
                  />

                  <button
                    type="button"
                    className="text-muted-foreground hover:text-primary"
                    onClick={() => setPositionen(positionen.filter((_, j) => j !== i))}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-border pt-4">
            <span className="text-sm text-muted-foreground">
              Gesamtbetrag: <span className="font-semibold text-foreground">{eur(gesamt)}</span>
            </span>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setModal(false)}>
                Abbrechen
              </Button>
              <Button type="submit" disabled={anlegen.isPending}>
                Speichern
              </Button>
            </div>
          </div>
        </form>
      </Modal>

      <RechnungDetail id={detailId} onClose={() => setDetailId(null)} onEdit={bearbeiten} />

      <Modal open={!!editId} onClose={() => setEditId(null)} title="Rechnung bearbeiten">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            speichern.mutate();
          }}
        >
          <Field label="Rechnungsnummer">
            <Input
              required
              value={editForm.rechnungsnummer}
              onChange={(e) => setEditForm({ ...editForm, rechnungsnummer: e.target.value })}
            />
          </Field>
          <Field label="Lieferant">
            <Select
              value={editForm.lieferant_id}
              onChange={(e) => setEditForm({ ...editForm, lieferant_id: e.target.value })}
            >
              <option value="">–</option>
              {(lieferanten.data ?? []).map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Datum">
              <Input
                type="date"
                value={editForm.datum}
                onChange={(e) => setEditForm({ ...editForm, datum: e.target.value })}
              />
            </Field>
            <Field label="Gesamtbetrag (€)">
              <Input
                type="number"
                step="any"
                value={editForm.gesamtbetrag}
                onChange={(e) => setEditForm({ ...editForm, gesamtbetrag: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Status">
            <Select
              value={String(editForm.bezahlt)}
              onChange={(e) => setEditForm({ ...editForm, bezahlt: e.target.value === "true" })}
            >
              <option value="false">Offen</option>
              <option value="true">Bezahlt</option>
            </Select>
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setEditId(null)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={speichern.isPending}>
              Speichern
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
