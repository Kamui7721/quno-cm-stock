import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { GitMerge, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { db } from "@/lib/db";
import { bulkUpdateKategorie } from "@/lib/produkte.functions";
import { ProduktDetail } from "@/components/ProduktDetail";
import { abweichungProzent, trendLabel, trendTone } from "@/lib/preise";
import { normalisiereBezeichnung } from "@/lib/aehnlichkeit";
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
  SearchInput,
  Select,
  Table,
  Tabs,
  Td,
  Tr,
} from "@/components/ui-kit";
import { datum, einheitLabel, eur, num } from "@/lib/format";
import { EINHEITEN } from "@/lib/types";

export const Route = createFileRoute("/produkte")({
  head: () => ({
    meta: [
      { title: "Produkte — QUNO x CM Inventur" },
      { name: "description", content: "Alle Produkte mit Kategorie, Lieferant und Bestand." },
      { property: "og:title", content: "Produkte — QUNO x CM Inventur" },
      {
        property: "og:description",
        content: "Alle Produkte mit Kategorie, Lieferant und Bestand.",
      },
    ],
  }),
  component: ProduktePage,
});

type PreisFelder = {
  letzter_ek?: number | string | null;
  durchschnitt_ek?: number | string | null;
};

function letzterEk(p: unknown): number | null {
  const v = (p as PreisFelder).letzter_ek;
  return v == null ? null : Number(v);
}

function trendWert(p: unknown): number | null {
  const row = p as PreisFelder;
  return abweichungProzent(
    row.letzter_ek == null ? null : Number(row.letzter_ek),
    row.durchschnitt_ek == null ? null : Number(row.durchschnitt_ek),
  );
}

const leer = {
  name: "",
  kategorie_id: "",
  lieferant_id: "",
  einheit: "stück",
  aktueller_bestand: "0",
};

function ProduktePage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("");
  const [suche, setSuche] = useState("");
  const [sucheAktiv, setSucheAktiv] = useState("");
  const [lieferantFilter, setLieferantFilter] = useState("");
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(leer);
  const [editId, setEditId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [auswahl, setAuswahl] = useState<string[]>([]);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeZielId, setMergeZielId] = useState<string | null>(null);
  const [sortFeld, setSortFeld] = useState<"name" | "letzter_ek" | "trend" | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const sortieren = (feld: "name" | "letzter_ek" | "trend") => {
    if (sortFeld === feld) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortFeld(feld);
      setSortDir(feld === "name" ? "asc" : "desc");
    }
  };
  const kopfZelle = (label: string, feld: "name" | "letzter_ek" | "trend") => ({
    label,
    onClick: () => sortieren(feld),
    ...(sortFeld === feld ? { dir: sortDir } : {}),
  });

  useEffect(() => {
    const t = setTimeout(() => setSucheAktiv(suche), 300);
    return () => clearTimeout(t);
  }, [suche]);

  const kategorien = useQuery({
    queryKey: ["kategorien"],
    queryFn: async () => {
      const { data, error } = await db.from("kategorien").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const lieferanten = useQuery({
    queryKey: ["lieferanten"],
    queryFn: async () => {
      const { data, error } = await db.from("lieferanten").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const produkte = useQuery({
    queryKey: ["produkte"],
    queryFn: async () => {
      const { data, error } = await db
        .from("produkte")
        .select("*, kategorien(name, farbe), lieferanten(*)")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const historie = useQuery({
    queryKey: ["produkt-historie", detailId],
    enabled: !!detailId,
    queryFn: async () => {
      const { data, error } = await db
        .from("zaehlungspositionen")
        .select("*, zaehlungen(datum, status)")
        .eq("produkt_id", detailId!);
      if (error) throw error;
      return data;
    },
  });

  const anlegen = useMutation({
    mutationFn: async () => {
      const { error } = await db.from("produkte").insert({
        name: form.name,
        bezeichnung_normalisiert: normalisiereBezeichnung(form.name),
        kategorie_id: form.kategorie_id || null,
        lieferant_id: form.lieferant_id || null,
        einheit: form.einheit,
        aktueller_bestand: Number(form.aktueller_bestand) || 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Produkt hinzugefügt");
      setModal(false);
      setForm(leer);
      qc.invalidateQueries({ queryKey: ["produkte"] });
    },
    onError: (e: Error) => toast.error(`Fehler: ${e.message}`),
  });

  const loeschen = useMutation({
    mutationFn: async (id: string) => {
      const r1 = await db
        .from("rechnungspositionen")
        .update({ produkt_id: null })
        .eq("produkt_id", id);
      if (r1.error) throw r1.error;
      const r2 = await db
        .from("zaehlungspositionen")
        .update({ produkt_id: null })
        .eq("produkt_id", id);
      if (r2.error) throw r2.error;
      const r3 = await db.from("verkaufszahlen").update({ produkt_id: null }).eq("produkt_id", id);
      if (r3.error) throw r3.error;
      const { error } = await db.from("produkte").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Produkt gelöscht");
      setDetailId(null);
      qc.invalidateQueries({ queryKey: ["produkte"] });
    },
    onError: (e: Error) => toast.error(`Fehler: ${e.message}`),
  });

  const loeschenBestaetigen = (id: string) => {
    if (
      window.confirm("Produkt wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.")
    ) {
      loeschen.mutate(id);
    }
  };

  const speichern = useMutation({
    mutationFn: async () => {
      const { error } = await db
        .from("produkte")
        .update({
          name: form.name,
          bezeichnung_normalisiert: normalisiereBezeichnung(form.name),
          kategorie_id: form.kategorie_id || null,
          lieferant_id: form.lieferant_id || null,
          einheit: form.einheit,
        })
        .eq("id", editId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Produkt aktualisiert");
      setEditId(null);
      setForm(leer);
      qc.invalidateQueries({ queryKey: ["produkte"] });
    },
    onError: (e: Error) => toast.error(`Fehler: ${e.message}`),
  });

  const bearbeiten = (p: {
    id: string;
    name?: string | null;
    kategorie_id?: string | null;
    lieferant_id?: string | null;
    einheit?: string | null;
    aktueller_bestand?: number | string | null;
  }) => {
    setForm({
      name: p.name ?? "",
      kategorie_id: p.kategorie_id ?? "",
      lieferant_id: p.lieferant_id ?? "",
      einheit: p.einheit ?? "stück",
      aktueller_bestand: String(p.aktueller_bestand ?? "0"),
    });
    setEditId(p.id);
  };

  const zusammenfuehren = useMutation({
    mutationFn: async ({ zielId, questId }: { zielId: string; questId: string }) => {
      const alle = produkte.data ?? [];
      const ziel = alle.find((p) => p.id === zielId);
      const quelle = alle.find((p) => p.id === questId);
      if (!ziel || !quelle) throw new Error("Produkte nicht gefunden");

      const r1 = await db
        .from("rechnungspositionen")
        .update({ produkt_id: zielId })
        .eq("produkt_id", questId);
      if (r1.error) throw r1.error;
      const r2 = await db
        .from("zaehlungspositionen")
        .update({ produkt_id: zielId })
        .eq("produkt_id", questId);
      if (r2.error) throw r2.error;
      const r3 = await db
        .from("verkaufszahlen")
        .update({ produkt_id: zielId })
        .eq("produkt_id", questId);
      if (r3.error) throw r3.error;

      const bestand = Number(ziel.aktueller_bestand) + Number(quelle.aktueller_bestand);
      const r4 = await db.from("produkte").update({ aktueller_bestand: bestand }).eq("id", zielId);
      if (r4.error) throw r4.error;

      const r5 = await db.from("produkte").delete().eq("id", questId);
      if (r5.error) throw r5.error;
    },
    onSuccess: () => {
      toast.success("Produkte zusammengeführt");
      setMergeOpen(false);
      setAuswahl([]);
      qc.invalidateQueries({ queryKey: ["produkte"] });
      qc.invalidateQueries({ queryKey: ["produkte-simple"] });
    },
    onError: (e: Error) => toast.error(`Fehler: ${e.message}`),
  });

  const alleProdukte = produkte.data ?? [];
  const suchbegriff = sucheAktiv.trim().toLowerCase();
  const passtZurSuche = (p: (typeof alleProdukte)[number]) =>
    !suchbegriff ||
    p.name.toLowerCase().includes(suchbegriff) ||
    (p.lieferanten?.name ?? "").toLowerCase().includes(suchbegriff);

  const basis = alleProdukte.filter(
    (p) => (!lieferantFilter || p.lieferant_id === lieferantFilter) && passtZurSuche(p),
  );
  const gefiltert = suchbegriff ? basis : basis.filter((p) => !tab || p.kategorie_id === tab);
  const liste = sortFeld
    ? gefiltert.slice().sort((a, b) => {
        const f = sortDir === "asc" ? 1 : -1;
        if (sortFeld === "name") return a.name.localeCompare(b.name) * f;
        if (sortFeld === "letzter_ek") {
          const av = letzterEk(a) ?? -Infinity;
          const bv = letzterEk(b) ?? -Infinity;
          return (av - bv) * f;
        }
        const at = trendWert(a) ?? -Infinity;
        const bt = trendWert(b) ?? -Infinity;
        return (at - bt) * f;
      })
    : gefiltert;

  const tabItems = [
    { key: "", label: "Alle", count: alleProdukte.length },
    ...(kategorien.data ?? []).map((k) => ({
      key: k.id,
      label: k.name,
      count: basis.filter((p) => p.kategorie_id === k.id).length,
    })),
  ];

  const detail = alleProdukte.find((p) => p.id === detailId);
  const gewaehlt = auswahl
    .map((id) => alleProdukte.find((p) => p.id === id))
    .filter((p): p is (typeof alleProdukte)[number] => !!p);
  const mergeZiel = gewaehlt.find((p) => p.id === mergeZielId) ?? gewaehlt[0];
  const mergeQuelle = gewaehlt.find((p) => p.id !== mergeZiel?.id);

  return (
    <div>
      <PageHeader
        title="Produkte"
        subtitle="Alle Artikel im Inventar"
        action={
          <Button onClick={() => setModal(true)}>
            <Plus size={16} /> Produkt hinzufügen
          </Button>
        }
      />

      <div className="mb-4 space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row">
          <SearchInput
            className="w-full sm:w-80"
            value={suche}
            onChange={setSuche}
            placeholder="Produkt suchen..."
          />
          <div className="w-full sm:w-64">
            <Select value={lieferantFilter} onChange={(e) => setLieferantFilter(e.target.value)}>
              <option value="">Alle Lieferanten</option>
              {(lieferanten.data ?? []).map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <Tabs value={tab} onChange={setTab} items={tabItems} />

        {suchbegriff && <p className="text-xs text-muted-foreground">Suche über alle Kategorien</p>}

        {auswahl.length > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs text-muted-foreground">
              {auswahl.length} Produkt(e) ausgewählt
            </span>
            {auswahl.length === 2 && (
              <Button
                variant="outline"
                className="px-3 py-1.5 text-xs"
                onClick={() => {
                  setMergeZielId(auswahl[0] ?? null);
                  setMergeOpen(true);
                }}
              >
                <GitMerge size={14} /> Zusammenführen
              </Button>
            )}
            <button
              type="button"
              className="text-xs text-muted-foreground underline hover:text-foreground"
              onClick={() => setAuswahl([])}
            >
              Auswahl aufheben
            </button>
          </div>
        )}
      </div>

      <Card>
        {produkte.error ? (
          <Empty text={`Fehler: ${produkte.error.message}`} />
        ) : liste.length === 0 ? (
          <Empty text="Keine Produkte vorhanden." />
        ) : (
          <Table
            head={[
              "",
              kopfZelle("Name", "name"),
              "Kategorie",
              "Lieferant",
              "Einheit",
              "Bestand",
              kopfZelle("Letzter EK", "letzter_ek"),
              kopfZelle("Trend", "trend"),
              "",
            ]}
          >
            {liste.map((p) => (
              <Tr key={p.id} onClick={() => setDetailId(p.id)}>
                <Td>
                  <span onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={auswahl.includes(p.id)}
                      onChange={(v) =>
                        setAuswahl(v ? [...auswahl, p.id] : auswahl.filter((x) => x !== p.id))
                      }
                    />
                  </span>
                </Td>
                <Td>{p.name}</Td>
                <Td>
                  {p.kategorien ? (
                    <Badge color={p.kategorien.farbe}>{p.kategorien.name}</Badge>
                  ) : (
                    "–"
                  )}
                </Td>
                <Td>{p.lieferanten?.name ?? "–"}</Td>
                <Td>{einheitLabel(p.einheit)}</Td>
                <Td>
                  {num(Number(p.aktueller_bestand))} {einheitLabel(p.einheit)}
                </Td>
                <Td>{letzterEk(p) !== null ? eur(letzterEk(p)!) : "–"}</Td>
                <Td>
                  {trendWert(p) === null ? (
                    <span className="text-muted-foreground">–</span>
                  ) : (
                    <Badge tone={trendTone(trendWert(p)!)}>{trendLabel(trendWert(p)!)}</Badge>
                  )}
                </Td>
                <Td className="text-right">
                  <button
                    type="button"
                    aria-label={`${p.name} bearbeiten`}
                    className="mr-1 rounded-md p-1.5 text-muted-foreground transition hover:bg-surface-2 hover:text-foreground"
                    onClick={(e) => {
                      e.stopPropagation();
                      bearbeiten(p);
                    }}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    aria-label={`${p.name} löschen`}
                    className="rounded-md p-1.5 text-destructive transition hover:bg-destructive/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      loeschenBestaetigen(p.id);
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </Td>
              </Tr>
            ))}
          </Table>
        )}
      </Card>

      <Modal
        open={mergeOpen && gewaehlt.length === 2}
        onClose={() => setMergeOpen(false)}
        title="Produkte zusammenführen"
        wide
      >
        {mergeZiel && mergeQuelle && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Wähle das Ziel-Produkt. Alle Rechnungspositionen, Zählungen und Verkaufszahlen des
              anderen Produkts werden übertragen, die Bestände addiert.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {gewaehlt.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setMergeZielId(p.id)}
                  className={
                    "rounded-lg border p-4 text-left transition " +
                    (mergeZiel.id === p.id
                      ? "border-primary bg-primary/10"
                      : "border-border bg-surface-2 hover:bg-muted")
                  }
                >
                  <div className="text-sm font-semibold text-foreground">{p.name}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {p.kategorien?.name ?? "Keine Kategorie"} ·{" "}
                    {p.lieferanten?.name ?? "Kein Lieferant"}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Bestand: {num(Number(p.aktueller_bestand))} {einheitLabel(p.einheit)}
                  </div>
                  <div className="mt-2 text-xs font-medium text-primary">
                    {mergeZiel.id === p.id ? "Ziel-Datensatz (bleibt bestehen)" : "Wird gelöscht"}
                  </div>
                </button>
              ))}
            </div>
            <div className="rounded-lg border border-border bg-surface-2 p-3 text-sm">
              Neuer Bestand:{" "}
              <span className="font-semibold">
                {num(Number(mergeZiel.aktueller_bestand) + Number(mergeQuelle.aktueller_bestand))}{" "}
                {einheitLabel(mergeZiel.einheit)}
              </span>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setMergeOpen(false)}>
                Abbrechen
              </Button>
              <Button
                disabled={zusammenfuehren.isPending}
                onClick={() => {
                  if (
                    window.confirm(
                      `„${mergeQuelle.name}“ wird gelöscht und in „${mergeZiel.name}“ zusammengeführt. Fortfahren?`,
                    )
                  ) {
                    zusammenfuehren.mutate({ zielId: mergeZiel.id, questId: mergeQuelle.id });
                  }
                }}
              >
                Zusammenführen
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={modal} onClose={() => setModal(false)} title="Produkt hinzufügen">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            anlegen.mutate();
          }}
        >
          <Field label="Name">
            <Input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Kategorie">
              <Select
                value={form.kategorie_id}
                onChange={(e) => setForm({ ...form, kategorie_id: e.target.value })}
              >
                <option value="">–</option>
                {(kategorien.data ?? []).map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Lieferant">
              <Select
                value={form.lieferant_id}
                onChange={(e) => setForm({ ...form, lieferant_id: e.target.value })}
              >
                <option value="">–</option>
                {(lieferanten.data ?? []).map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Einheit">
              <Select
                value={form.einheit}
                onChange={(e) => setForm({ ...form, einheit: e.target.value })}
              >
                {EINHEITEN.map((e2) => (
                  <option key={e2.wert} value={e2.wert}>
                    {e2.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Aktueller Bestand">
              <Input
                type="number"
                step="any"
                value={form.aktueller_bestand}
                onChange={(e) => setForm({ ...form, aktueller_bestand: e.target.value })}
              />
            </Field>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setModal(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={anlegen.isPending}>
              Speichern
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!editId}
        onClose={() => {
          setEditId(null);
          setForm(leer);
        }}
        title="Produkt bearbeiten"
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            speichern.mutate();
          }}
        >
          <Field label="Name">
            <Input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Kategorie">
              <Select
                value={form.kategorie_id}
                onChange={(e) => setForm({ ...form, kategorie_id: e.target.value })}
              >
                <option value="">–</option>
                {(kategorien.data ?? []).map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Lieferant">
              <Select
                value={form.lieferant_id}
                onChange={(e) => setForm({ ...form, lieferant_id: e.target.value })}
              >
                <option value="">–</option>
                {(lieferanten.data ?? []).map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Einheit">
              <Select
                value={form.einheit}
                onChange={(e) => setForm({ ...form, einheit: e.target.value })}
              >
                {EINHEITEN.map((e2) => (
                  <option key={e2.wert} value={e2.wert}>
                    {e2.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEditId(null);
                setForm(leer);
              }}
            >
              Abbrechen
            </Button>
            <Button type="submit" disabled={speichern.isPending}>
              Speichern
            </Button>
          </div>
        </form>
      </Modal>

      <ProduktDetail
        produkt={detail ?? null}
        onClose={() => setDetailId(null)}
        onEdit={(p) => bearbeiten(p)}
        onDelete={(id) => loeschenBestaetigen(id)}
        zusatz={
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Zählungs-Verlauf
            </h3>
            {(historie.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Noch keine Zählungen.</p>
            ) : (
              <div className="space-y-2">
                {(historie.data ?? []).map((h) => (
                  <div
                    key={h.id}
                    className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm"
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-muted-foreground">
                        {datum(h.zaehlungen?.datum ?? null)}
                      </span>
                      <Badge tone={Number(h.differenz) < 0 ? "danger" : "success"}>
                        {num(Number(h.differenz_prozent), 1)} %
                      </Badge>
                    </div>
                    <div className="text-muted-foreground">
                      IST {num(Number(h.ist_bestand))} · SOLL {num(Number(h.soll_bestand))} ·
                      Differenz {num(Number(h.differenz))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        }
      />
    </div>
  );
}
