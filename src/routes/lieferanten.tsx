import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { GitMerge, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { db } from "@/lib/db";
import {
  Badge,
  Button,
  Card,
  Checkbox,
  DetailModal,
  Empty,
  Field,
  InfoRow,
  Input,
  Modal,
  PageHeader,
  SearchInput,
  Table,
  Tabs,
  Td,
  Tr,
} from "@/components/ui-kit";
import { einheitLabel, num } from "@/lib/format";

export const Route = createFileRoute("/lieferanten")({
  head: () => ({
    meta: [
      { title: "Lieferanten — QUNO x CM Inventur" },
      { name: "description", content: "Lieferanten mit Kontaktdaten, Kundennummer und IBAN." },
      { property: "og:title", content: "Lieferanten — QUNO x CM Inventur" },
      {
        property: "og:description",
        content: "Lieferanten mit Kontaktdaten, Kundennummer und IBAN.",
      },
    ],
  }),
  component: LieferantenPage,
});

const leer = {
  name: "",
  kontaktperson: "",
  telefon: "",
  email: "",
  adresse: "",
  kundennummer: "",
  iban: "",
};

type MergeFeld = "kontaktperson" | "telefon" | "email" | "adresse";
const MERGE_FELDER: [MergeFeld, string][] = [
  ["kontaktperson", "Kontaktperson"],
  ["telefon", "Telefon"],
  ["email", "E-Mail"],
  ["adresse", "Adresse"],
];

function LieferantenPage() {
  const qc = useQueryClient();
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(leer);
  const [formKategorien, setFormKategorien] = useState<string[]>([]);
  const [editId, setEditId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [tab, setTab] = useState("");
  const [suche, setSuche] = useState("");
  const [sucheAktiv, setSucheAktiv] = useState("");
  const [auswahl, setAuswahl] = useState<string[]>([]);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeZielId, setMergeZielId] = useState<string | null>(null);
  const [mergeWerte, setMergeWerte] = useState<Record<MergeFeld, "ziel" | "quelle">>({
    kontaktperson: "ziel",
    telefon: "ziel",
    email: "ziel",
    adresse: "ziel",
  });

  useEffect(() => {
    const t = setTimeout(() => setSucheAktiv(suche), 300);
    return () => clearTimeout(t);
  }, [suche]);

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

  const zuordnungen = useQuery({
    queryKey: ["lieferant-kategorien"],
    queryFn: async () => {
      const { data, error } = await db.from("lieferant_kategorien").select("*");
      if (error) throw error;
      return data as { id: string; lieferant_id: string; kategorie: string }[];
    },
  });

  const produkte = useQuery({
    queryKey: ["lieferant-produkte", detailId],
    enabled: !!detailId,
    queryFn: async () => {
      const { data, error } = await db
        .from("produkte")
        .select("*")
        .eq("lieferant_id", detailId!)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const katVon = (id: string) =>
    (zuordnungen.data ?? []).filter((z) => z.lieferant_id === id).map((z) => z.kategorie);

  const farbeVon = (name: string) =>
    (kategorien.data ?? []).find((k) => k.name === name)?.farbe ?? undefined;

  const kategorienSpeichern = async (lieferantId: string, gewaehlt: string[]) => {
    const del = await db.from("lieferant_kategorien").delete().eq("lieferant_id", lieferantId);
    if (del.error) throw del.error;
    if (gewaehlt.length) {
      const res = await db
        .from("lieferant_kategorien")
        .insert(gewaehlt.map((kategorie) => ({ lieferant_id: lieferantId, kategorie })));
      if (res.error) throw res.error;
    }
  };

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["lieferanten"] });
    qc.invalidateQueries({ queryKey: ["lieferant-kategorien"] });
    qc.invalidateQueries({ queryKey: ["produkte"] });
    qc.invalidateQueries({ queryKey: ["rechnungen"] });
  };

  const anlegen = useMutation({
    mutationFn: async () => {
      const { data, error } = await db.from("lieferanten").insert(form).select("id").single();
      if (error) throw error;
      await kategorienSpeichern(data.id, formKategorien);
    },
    onSuccess: () => {
      toast.success("Lieferant hinzugefügt");
      setModal(false);
      setForm(leer);
      setFormKategorien([]);
      invalidate();
    },
    onError: (e: Error) => toast.error(`Fehler: ${e.message}`),
  });

  const speichern = useMutation({
    mutationFn: async () => {
      const { error } = await db.from("lieferanten").update(form).eq("id", editId!);
      if (error) throw error;
      await kategorienSpeichern(editId!, formKategorien);
    },
    onSuccess: () => {
      toast.success("Lieferant aktualisiert");
      setEditId(null);
      setForm(leer);
      setFormKategorien([]);
      invalidate();
    },
    onError: (e: Error) => toast.error(`Fehler: ${e.message}`),
  });

  const loeschen = useMutation({
    mutationFn: async (id: string) => {
      const r1 = await db.from("produkte").update({ lieferant_id: null }).eq("lieferant_id", id);
      if (r1.error) throw r1.error;
      const r2 = await db.from("rechnungen").update({ lieferant_id: null }).eq("lieferant_id", id);
      if (r2.error) throw r2.error;
      const { error } = await db.from("lieferanten").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lieferant gelöscht");
      setDetailId(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(`Fehler: ${e.message}`),
  });

  /** Leitet Kategorien aus den Kategorien der zugeordneten Produkte ab (nur ergänzend). */
  const ableiten = useMutation({
    mutationFn: async () => {
      const p = await db.from("produkte").select("lieferant_id, kategorie_id");
      if (p.error) throw new Error(p.error.message);
      const katName = new Map((kategorien.data ?? []).map((k) => [k.id, k.name]));
      const vorhanden = new Set(
        (zuordnungen.data ?? []).map((z) => `${z.lieferant_id}|${z.kategorie}`),
      );
      const neu: { lieferant_id: string; kategorie: string }[] = [];
      for (const row of p.data ?? []) {
        if (!row.lieferant_id || !row.kategorie_id) continue;
        const name = katName.get(row.kategorie_id);
        if (!name) continue;
        const key = `${row.lieferant_id}|${name}`;
        if (vorhanden.has(key)) continue;
        vorhanden.add(key);
        neu.push({ lieferant_id: row.lieferant_id, kategorie: name });
      }
      if (neu.length) {
        const r = await db.from("lieferant_kategorien").insert(neu);
        if (r.error) throw new Error(r.error.message);
      }
      return neu.length;
    },
    onSuccess: (n) => {
      if (n > 0) toast.success(`${n} Kategorie-Zuordnung(en) ergänzt`);
      qc.invalidateQueries({ queryKey: ["lieferant-kategorien"] });
    },
    onError: (e: Error) => toast.error(`Fehler: ${e.message}`),
  });

  // Einmalige Erstbefüllung, solange noch keine Zuordnung existiert.
  const initRef = useRef(false);
  useEffect(() => {
    if (initRef.current) return;
    if (zuordnungen.data?.length === 0 && (kategorien.data ?? []).length > 0) {
      initRef.current = true;
      ableiten.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zuordnungen.data, kategorien.data]);

  const alle = lieferanten.data ?? [];
  const suchbegriff = sucheAktiv.trim().toLowerCase();
  const basis = alle.filter(
    (l) =>
      !suchbegriff ||
      l.name.toLowerCase().includes(suchbegriff) ||
      (l.kontaktperson ?? "").toLowerCase().includes(suchbegriff) ||
      (l.email ?? "").toLowerCase().includes(suchbegriff),
  );
  const liste = suchbegriff ? basis : basis.filter((l) => !tab || katVon(l.id).includes(tab));

  const tabItems = [
    { key: "", label: "Alle", count: alle.length },
    ...(kategorien.data ?? []).map((k) => ({
      key: k.name,
      label: k.name,
      count: basis.filter((l) => katVon(l.id).includes(k.name)).length,
    })),
  ];

  const detail = alle.find((l) => l.id === detailId);
  const gewaehlt = auswahl.map((id) => alle.find((l) => l.id === id)).filter((l) => !!l);
  const mergeZiel = gewaehlt.find((l) => l.id === mergeZielId) ?? gewaehlt[0];
  const mergeQuelle = gewaehlt.find((l) => l.id !== mergeZiel?.id);

  const mergeInfo = useQuery({
    queryKey: ["merge-info", mergeQuelle?.id],
    enabled: mergeOpen && !!mergeQuelle,
    queryFn: async () => {
      const r = await db.from("rechnungen").select("id").eq("lieferant_id", mergeQuelle!.id);
      if (r.error) throw r.error;
      const p = await db.from("produkte").select("id").eq("lieferant_id", mergeQuelle!.id);
      if (p.error) throw p.error;
      return { rechnungen: (r.data ?? []).length, produkte: (p.data ?? []).length };
    },
  });

  const zusammenfuehren = useMutation({
    mutationFn: async () => {
      if (!mergeZiel || !mergeQuelle) throw new Error("Auswahl unvollständig");
      const updates: Record<string, string | null> = {};
      for (const [feld] of MERGE_FELDER) {
        const zielWert = (mergeZiel[feld] ?? "") as string;
        const quelleWert = (mergeQuelle[feld] ?? "") as string;
        const wunsch = mergeWerte[feld] === "quelle" ? quelleWert : zielWert;
        updates[feld] = wunsch || zielWert || quelleWert || null;
      }
      for (const feld of ["kundennummer", "iban"] as const) {
        updates[feld] = (mergeZiel[feld] ?? mergeQuelle[feld] ?? null) as string | null;
      }
      const u = await db.from("lieferanten").update(updates).eq("id", mergeZiel.id);
      if (u.error) throw u.error;

      const r1 = await db
        .from("rechnungen")
        .update({ lieferant_id: mergeZiel.id })
        .eq("lieferant_id", mergeQuelle.id);
      if (r1.error) throw r1.error;
      const r2 = await db
        .from("produkte")
        .update({ lieferant_id: mergeZiel.id })
        .eq("lieferant_id", mergeQuelle.id);
      if (r2.error) throw r2.error;

      const vereint = Array.from(new Set([...katVon(mergeZiel.id), ...katVon(mergeQuelle.id)]));
      await kategorienSpeichern(mergeZiel.id, vereint);

      const del = await db.from("lieferanten").delete().eq("id", mergeQuelle.id);
      if (del.error) throw del.error;
    },
    onSuccess: () => {
      toast.success("Lieferanten zusammengeführt");
      setMergeOpen(false);
      setAuswahl([]);
      invalidate();
    },
    onError: (e: Error) => toast.error(`Fehler: ${e.message}`),
  });

  const felder: [keyof typeof leer, string][] = [
    ["name", "Name"],
    ["kontaktperson", "Kontaktperson"],
    ["telefon", "Telefon"],
    ["email", "Email"],
    ["adresse", "Adresse"],
    ["kundennummer", "Kundennummer"],
    ["iban", "IBAN"],
  ];

  const bearbeiten = (l: { id: string } & Partial<typeof leer>) => {
    setForm({
      name: l.name ?? "",
      kontaktperson: l.kontaktperson ?? "",
      telefon: l.telefon ?? "",
      email: l.email ?? "",
      adresse: l.adresse ?? "",
      kundennummer: l.kundennummer ?? "",
      iban: l.iban ?? "",
    });
    setFormKategorien(katVon(l.id));
    setEditId(l.id);
  };

  const kategorieAuswahl = (
    <Field label="Kategorien">
      <div className="flex flex-wrap gap-4 rounded-lg border border-border bg-surface-2 px-3 py-3">
        {(kategorien.data ?? []).length === 0 ? (
          <span className="text-sm text-muted-foreground">Keine Kategorien vorhanden.</span>
        ) : (
          (kategorien.data ?? []).map((k) => (
            <Checkbox
              key={k.id}
              label={k.name}
              checked={formKategorien.includes(k.name)}
              onChange={(v) =>
                setFormKategorien(
                  v ? [...formKategorien, k.name] : formKategorien.filter((x) => x !== k.name),
                )
              }
            />
          ))
        )}
      </div>
    </Field>
  );

  return (
    <div>
      <PageHeader
        title="Lieferanten"
        subtitle="Alle Partner und Kontaktdaten"
        action={
          <Button
            onClick={() => {
              setForm(leer);
              setFormKategorien([]);
              setModal(true);
            }}
          >
            <Plus size={16} /> Lieferant hinzufügen
          </Button>
        }
      />

      <div className="mb-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput
            className="w-full sm:w-80"
            value={suche}
            onChange={setSuche}
            placeholder="Lieferant suchen..."
          />
          <button
            type="button"
            disabled={ableiten.isPending}
            onClick={() => ableiten.mutate()}
            className="text-xs text-muted-foreground underline underline-offset-2 transition hover:text-foreground disabled:opacity-50"
          >
            Kategorien aus Produkten ableiten
          </button>
        </div>
        <Tabs value={tab} onChange={setTab} items={tabItems} />
        {suchbegriff && <p className="text-xs text-muted-foreground">Suche über alle Kategorien</p>}

        {auswahl.length > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs text-muted-foreground">
              {auswahl.length} Lieferant(en) ausgewählt
            </span>
            {auswahl.length === 2 && (
              <Button
                variant="outline"
                className="px-3 py-1.5 text-xs"
                onClick={() => {
                  setMergeZielId(auswahl[0] ?? null);
                  setMergeWerte({
                    kontaktperson: "ziel",
                    telefon: "ziel",
                    email: "ziel",
                    adresse: "ziel",
                  });
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
        {lieferanten.error ? (
          <Empty text={`Fehler: ${lieferanten.error.message}`} />
        ) : liste.length === 0 ? (
          <Empty text="Keine Lieferanten vorhanden." />
        ) : (
          <Table head={["", "Name", "Kategorien", "Kontaktperson", "Telefon", "Email", ""]}>
            {liste.map((l) => (
              <Tr key={l.id} onClick={() => setDetailId(l.id)}>
                <Td>
                  <span onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={auswahl.includes(l.id)}
                      onChange={(v) =>
                        setAuswahl(v ? [...auswahl, l.id] : auswahl.filter((x) => x !== l.id))
                      }
                    />
                  </span>
                </Td>
                <Td>{l.name}</Td>
                <Td>
                  <span className="flex flex-wrap justify-end gap-1 md:justify-start">
                    {katVon(l.id).length === 0
                      ? "–"
                      : katVon(l.id).map((k) => (
                          <Badge key={k} color={farbeVon(k)}>
                            {k}
                          </Badge>
                        ))}
                  </span>
                </Td>
                <Td>{l.kontaktperson ?? "–"}</Td>
                <Td>{l.telefon ?? "–"}</Td>
                <Td>{l.email ?? "–"}</Td>
                <Td className="text-right">
                  <button
                    type="button"
                    aria-label={`${l.name} bearbeiten`}
                    className="rounded-md p-1.5 text-muted-foreground transition hover:bg-surface-2 hover:text-foreground"
                    onClick={(e) => {
                      e.stopPropagation();
                      bearbeiten(l);
                    }}
                  >
                    <Pencil size={16} />
                  </button>
                </Td>
              </Tr>
            ))}
          </Table>
        )}
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} title="Lieferant hinzufügen">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            anlegen.mutate();
          }}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {felder.map(([key, label]) => (
              <Field key={key} label={label}>
                <Input
                  required={key === "name"}
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                />
              </Field>
            ))}
          </div>
          {kategorieAuswahl}
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
          setFormKategorien([]);
        }}
        title="Lieferant bearbeiten"
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            speichern.mutate();
          }}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {felder.map(([key, label]) => (
              <Field key={key} label={label}>
                <Input
                  required={key === "name"}
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                />
              </Field>
            ))}
          </div>
          {kategorieAuswahl}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEditId(null);
                setForm(leer);
                setFormKategorien([]);
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

      <Modal
        open={mergeOpen && gewaehlt.length === 2}
        onClose={() => setMergeOpen(false)}
        title="Lieferanten zusammenführen"
        wide
      >
        {mergeZiel && mergeQuelle && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Wähle den Ziel-Datensatz und pro Feld den Wert, der übernommen wird.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {gewaehlt.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setMergeZielId(l.id)}
                  className={
                    "rounded-lg border p-4 text-left transition " +
                    (mergeZiel.id === l.id
                      ? "border-primary bg-primary/10"
                      : "border-border bg-surface-2 hover:bg-muted")
                  }
                >
                  <div className="text-sm font-semibold text-foreground">{l.name}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {l.email ?? "keine E-Mail"}
                  </div>
                  <div className="mt-2 text-xs font-medium text-primary">
                    {mergeZiel.id === l.id ? "Ziel-Datensatz (bleibt bestehen)" : "Wird gelöscht"}
                  </div>
                </button>
              ))}
            </div>

            <div className="space-y-2">
              {MERGE_FELDER.map(([feld, label]) => {
                const zielWert = (mergeZiel[feld] ?? "") as string;
                const quelleWert = (mergeQuelle[feld] ?? "") as string;
                return (
                  <div key={feld} className="rounded-lg border border-border bg-surface-2 p-3">
                    <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      {label}
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {(
                        [
                          ["ziel", zielWert, mergeZiel.name],
                          ["quelle", quelleWert, mergeQuelle.name],
                        ] as const
                      ).map(([quelleKey, wert, wer]) => (
                        <button
                          key={quelleKey}
                          type="button"
                          onClick={() => setMergeWerte({ ...mergeWerte, [feld]: quelleKey })}
                          className={
                            "rounded-md border px-3 py-2 text-left text-sm transition " +
                            (mergeWerte[feld] === quelleKey
                              ? "border-primary bg-primary/10 text-foreground"
                              : "border-border text-muted-foreground hover:text-foreground")
                          }
                        >
                          <span className="block text-[11px] uppercase tracking-wider text-muted-foreground">
                            {wer}
                          </span>
                          {wert || "leer"}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="rounded-lg border border-border bg-surface-2 p-3 text-sm text-muted-foreground">
              Es werden {mergeInfo.data?.rechnungen ?? 0} Rechnung(en) und{" "}
              {mergeInfo.data?.produkte ?? 0} Produkt(e) auf „{mergeZiel.name}“ verschoben. Die
              Kategorien beider Lieferanten werden vereint.
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
                      `„${mergeQuelle.name}“ wird gelöscht. ${mergeInfo.data?.rechnungen ?? 0} Rechnung(en) und ${mergeInfo.data?.produkte ?? 0} Produkt(e) werden auf „${mergeZiel.name}“ verschoben. Fortfahren?`,
                    )
                  ) {
                    zusammenfuehren.mutate();
                  }
                }}
              >
                Zusammenführen
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <DetailModal
        open={!!detail}
        onClose={() => setDetailId(null)}
        title={detail?.name ?? "Lieferant"}
        action={
          detail ? (
            <button
              type="button"
              aria-label="Lieferant bearbeiten"
              className="rounded-md p-1.5 text-muted-foreground transition hover:bg-surface-2 hover:text-foreground"
              onClick={() => bearbeiten(detail)}
            >
              <Pencil size={16} />
            </button>
          ) : null
        }
        footer={
          detail ? (
            <Button
              variant="danger"
              className="w-full"
              disabled={loeschen.isPending}
              onClick={() => {
                if (
                  window.confirm(
                    "Lieferant wirklich löschen? Verknüpfte Produkte verlieren die Lieferanten-Zuordnung.",
                  )
                ) {
                  loeschen.mutate(detail.id);
                }
              }}
            >
              <Trash2 size={16} /> Lieferant löschen
            </Button>
          ) : null
        }
      >
        {detail && (
          <>
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Stammdaten
              </h3>
              <InfoRow
                label="Kategorien"
                value={
                  katVon(detail.id).length === 0 ? (
                    "–"
                  ) : (
                    <span className="flex flex-wrap justify-end gap-1">
                      {katVon(detail.id).map((k) => (
                        <Badge key={k} color={farbeVon(k)}>
                          {k}
                        </Badge>
                      ))}
                    </span>
                  )
                }
              />
              <InfoRow label="Kontaktperson" value={detail.kontaktperson ?? "–"} />
              <InfoRow label="Telefon" value={detail.telefon ?? "–"} />
              <InfoRow label="Email" value={detail.email ?? "–"} />
              <InfoRow label="Adresse" value={detail.adresse ?? "–"} />
              <InfoRow label="Kundennummer" value={detail.kundennummer ?? "–"} />
              <InfoRow label="IBAN" value={detail.iban ?? "–"} />
            </div>
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Verknüpfte Produkte
              </h3>
              {(produkte.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Keine Produkte verknüpft.</p>
              ) : (
                <div className="space-y-2">
                  {(produkte.data ?? []).map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm"
                    >
                      <span>{p.name}</span>
                      <span className="text-muted-foreground">
                        {num(Number(p.aktueller_bestand))} {einheitLabel(p.einheit)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </DetailModal>
    </div>
  );
}
