import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus } from "lucide-react";
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
import { datum, num } from "@/lib/format";
import { EINHEITEN } from "@/lib/types";

export const Route = createFileRoute("/produkte")({
  head: () => ({
    meta: [
      { title: "Produkte — QUNO x CM Inventur" },
      { name: "description", content: "Alle Produkte mit Kategorie, Lieferant und Bestand." },
      { property: "og:title", content: "Produkte — QUNO x CM Inventur" },
      { property: "og:description", content: "Alle Produkte mit Kategorie, Lieferant und Bestand." },
    ],
  }),
  component: ProduktePage,
});

const leer = {
  name: "",
  kategorie_id: "",
  lieferant_id: "",
  einheit: "stück",
  aktueller_bestand: "0",
};

function ProduktePage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState("");
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(leer);
  const [detailId, setDetailId] = useState<string | null>(null);

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

  const liste = (produkte.data ?? []).filter((p) => !filter || p.kategorie_id === filter);
  const detail = (produkte.data ?? []).find((p) => p.id === detailId);

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

      <div className="mb-4 w-64">
        <Select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">Alle Kategorien</option>
          {(kategorien.data ?? []).map((k) => (
            <option key={k.id} value={k.id}>
              {k.name}
            </option>
          ))}
        </Select>
      </div>

      <Card>
        {produkte.error ? (
          <Empty text={`Fehler: ${produkte.error.message}`} />
        ) : liste.length === 0 ? (
          <Empty text="Keine Produkte vorhanden." />
        ) : (
          <Table head={["Name", "Kategorie", "Lieferant", "Einheit", "Bestand"]}>
            {liste.map((p) => (
              <Tr key={p.id} onClick={() => setDetailId(p.id)}>
                <Td>{p.name}</Td>
                <Td>
                  {p.kategorien ? (
                    <Badge color={p.kategorien.farbe}>{p.kategorien.name}</Badge>
                  ) : (
                    "–"
                  )}
                </Td>
                <Td>{p.lieferanten?.name ?? "–"}</Td>
                <Td>{p.einheit}</Td>
                <Td>
                  {num(Number(p.aktueller_bestand))} {p.einheit}
                </Td>
              </Tr>
            ))}
          </Table>
        )}
      </Card>

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
          <div className="grid grid-cols-2 gap-4">
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
                  <option key={e2} value={e2}>
                    {e2}
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

      <Drawer
        open={!!detail}
        onClose={() => setDetailId(null)}
        title={detail?.name ?? "Produkt"}
      >
        {detail && (
          <>
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Produkt
              </h3>
              <InfoRow label="Name" value={detail.name} />
              <InfoRow
                label="Kategorie"
                value={
                  detail.kategorien ? (
                    <Badge color={detail.kategorien.farbe}>{detail.kategorien.name}</Badge>
                  ) : (
                    "–"
                  )
                }
              />
              <InfoRow label="Einheit" value={detail.einheit} />
              <InfoRow
                label="Aktueller Bestand"
                value={`${num(Number(detail.aktueller_bestand))} ${detail.einheit}`}
              />
              <InfoRow label="Angelegt am" value={datum(detail.erstellt_am)} />
            </div>

            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Lieferant
              </h3>
              <InfoRow label="Name" value={detail.lieferanten?.name ?? "–"} />
              <InfoRow label="Kontaktperson" value={detail.lieferanten?.kontaktperson ?? "–"} />
              <InfoRow label="Telefon" value={detail.lieferanten?.telefon ?? "–"} />
              <InfoRow label="Email" value={detail.lieferanten?.email ?? "–"} />
              <InfoRow label="Adresse" value={detail.lieferanten?.adresse ?? "–"} />
              <InfoRow label="Kundennummer" value={detail.lieferanten?.kundennummer ?? "–"} />
              <InfoRow label="IBAN" value={detail.lieferanten?.iban ?? "–"} />
            </div>

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
          </>
        )}
      </Drawer>
    </div>
  );
}