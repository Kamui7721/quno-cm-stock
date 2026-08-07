import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { FileText, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { db } from "@/lib/db";
import {
  Badge,
  Button,
  Card,
  Drawer,
  Empty,
  Field,
  InfoRow,
  Input,
  Modal,
  PageHeader,
  Select,
  Table,
  Td,
  Tr,
} from "@/components/ui-kit";
import { datum, eur, num } from "@/lib/format";

export const Route = createFileRoute("/rechnungen")({
  head: () => ({
    meta: [
      { title: "Rechnungen — QUNO x CM Inventur" },
      { name: "description", content: "Eingangsrechnungen mit Positionen und Zahlungsstatus." },
      { property: "og:title", content: "Rechnungen — QUNO x CM Inventur" },
      { property: "og:description", content: "Eingangsrechnungen mit Positionen und Zahlungsstatus." },
    ],
  }),
  component: RechnungenPage,
});

type PosForm = {
  bezeichnung: string;
  kategorie_id: string;
  produkt_id: string;
  menge: string;
  preis: string;
};

const leerePos = (): PosForm => ({
  bezeichnung: "",
  kategorie_id: "",
  produkt_id: "",
  menge: "1",
  preis: "0",
});

function RechnungenPage() {
  const qc = useQueryClient();
  const [modal, setModal] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [filterLieferant, setFilterLieferant] = useState("");
  const [filterMonat, setFilterMonat] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [kopf, setKopf] = useState({
    rechnungsnummer: "",
    lieferant_id: "",
    datum: new Date().toISOString().slice(0, 10),
  });
  const [positionen, setPositionen] = useState<PosForm[]>([leerePos()]);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    rechnungsnummer: "",
    lieferant_id: "",
    datum: "",
    gesamtbetrag: "0",
    bezahlt: false,
  });

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
        .order("datum", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const detailPositionen = useQuery({
    queryKey: ["rechnungspositionen", detailId],
    enabled: !!detailId,
    queryFn: async () => {
      const { data, error } = await db
        .from("rechnungspositionen")
        .select("*, kategorien(name, farbe)")
        .eq("rechnung_id", detailId!);
      if (error) throw error;
      return data;
    },
  });

  const gesamt = positionen.reduce(
    (s, p) => s + (Number(p.menge) || 0) * (Number(p.preis) || 0),
    0,
  );

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
          menge: Number(p.menge) || 0,
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
      setKopf({ rechnungsnummer: "", lieferant_id: "", datum: new Date().toISOString().slice(0, 10) });
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

  const loeschen = useMutation({
    mutationFn: async (id: string) => {
      const pos = await db.from("rechnungspositionen").delete().eq("rechnung_id", id);
      if (pos.error) throw pos.error;
      const res = await db.from("rechnungen").delete().eq("id", id);
      if (res.error) throw res.error;
    },
    onSuccess: () => {
      toast.success("Rechnung gelöscht");
      setDetailId(null);
      qc.invalidateQueries({ queryKey: ["rechnungen"] });
    },
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

  const liste = (rechnungen.data ?? []).filter(
    (r) =>
      (!filterLieferant || r.lieferant_id === filterLieferant) &&
      (!filterMonat || r.datum.slice(0, 7) === filterMonat) &&
      (!filterStatus || String(r.bezahlt) === filterStatus),
  );
  const detail = (rechnungen.data ?? []).find((r) => r.id === detailId);

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

      <div className="mb-4 grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3">
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
      </div>

      <Card>
        {rechnungen.error ? (
          <Empty text={`Fehler: ${rechnungen.error.message}`} />
        ) : liste.length === 0 ? (
          <Empty text="Keine Rechnungen vorhanden." />
        ) : (
          <Table head={["Rechnungsnummer", "Lieferant", "Datum", "Betrag", "Status", "PDF"]}>
            {liste.map((r) => (
              <Tr key={r.id} onClick={() => setDetailId(r.id)}>
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
                  {r.pdf_url ? (
                    <a
                      href={r.pdf_url}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-primary hover:opacity-80"
                    >
                      <FileText size={16} />
                    </a>
                  ) : (
                    <span className="text-muted-foreground">–</span>
                  )}
                </Td>
              </Tr>
            ))}
          </Table>
        )}
      </Card>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Rechnung manuell hinzufügen"
        wide
      >
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
                <div key={i} className="grid grid-cols-[2fr_1fr_1fr_70px_90px_32px] items-center gap-2">
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
                  <Input
                    type="number"
                    step="any"
                    value={p.menge}
                    onChange={(e) =>
                      setPositionen(
                        positionen.map((x, j) => (j === i ? { ...x, menge: e.target.value } : x)),
                      )
                    }
                  />
                  <Input
                    type="number"
                    step="any"
                    value={p.preis}
                    onChange={(e) =>
                      setPositionen(
                        positionen.map((x, j) => (j === i ? { ...x, preis: e.target.value } : x)),
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

      <Drawer
        open={!!detail}
        onClose={() => setDetailId(null)}
        title={detail ? `Rechnung ${detail.rechnungsnummer}` : "Rechnung"}
        action={
          detail ? (
            <button
              type="button"
              aria-label="Rechnung bearbeiten"
              className="rounded-md p-1.5 text-muted-foreground transition hover:bg-surface-2 hover:text-foreground"
              onClick={() => bearbeiten(detail)}
            >
              <Pencil size={16} />
            </button>
          ) : null
        }
      >
        {detail && (
          <>
            <div>
              <InfoRow label="Lieferant" value={detail.lieferanten?.name ?? "–"} />
              <InfoRow label="Datum" value={datum(detail.datum)} />
              <InfoRow label="Gesamtbetrag" value={eur(Number(detail.gesamtbetrag))} />
              <InfoRow
                label="Status"
                value={
                  <Badge
                    tone={detail.bezahlt ? "success" : "warning"}
                    onClick={() =>
                      statusToggle.mutate({ id: detail.id, bezahlt: !detail.bezahlt })
                    }
                  >
                    {detail.bezahlt ? "bezahlt" : "offen"}
                  </Badge>
                }
              />
            </div>

            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Positionen
              </h3>
              {(detailPositionen.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Keine Positionen erfasst.</p>
              ) : (
                <div className="space-y-2">
                  {(detailPositionen.data ?? []).map((p) => (
                    <div
                      key={p.id}
                      className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">
                          {num(Number(p.menge))} × {p.bezeichnung}
                        </span>
                        <span>{eur(Number(p.preis))}</span>
                      </div>
                      {p.kategorien && (
                        <div className="mt-1 flex items-center gap-2 text-muted-foreground">
                          <Badge color={p.kategorien.farbe}>{p.kategorien.name}</Badge>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {detail.pdf_url?.trim() ? (
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  PDF
                </h3>
                <iframe
                  src={detail.pdf_url}
                  title="PDF-Vorschau"
                  className="h-80 w-full rounded-lg border border-border bg-surface-2"
                />
              </div>
            ) : null}

            <div className="border-t border-border pt-4">
              <Button
                variant="danger"
                className="w-full"
                disabled={loeschen.isPending}
                onClick={() => {
                  if (
                    window.confirm(
                      "Rechnung wirklich löschen? Alle Positionen werden ebenfalls gelöscht.",
                    )
                  ) {
                    loeschen.mutate(detail.id);
                  }
                }}
              >
                <Trash2 size={16} /> Rechnung löschen
              </Button>
            </div>
          </>
        )}
      </Drawer>

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