import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Button,
  Card,
  Drawer,
  Empty,
  Field,
  InfoRow,
  Input,
  Modal,
  PageHeader,
  Table,
  Td,
  Tr,
} from "@/components/ui-kit";
import { num } from "@/lib/format";

export const Route = createFileRoute("/lieferanten")({
  head: () => ({
    meta: [
      { title: "Lieferanten — QUNO x CM Inventur" },
      { name: "description", content: "Lieferanten mit Kontaktdaten, Kundennummer und IBAN." },
      { property: "og:title", content: "Lieferanten — QUNO x CM Inventur" },
      { property: "og:description", content: "Lieferanten mit Kontaktdaten, Kundennummer und IBAN." },
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

function LieferantenPage() {
  const qc = useQueryClient();
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(leer);
  const [detailId, setDetailId] = useState<string | null>(null);

  const lieferanten = useQuery({
    queryKey: ["lieferanten"],
    queryFn: async () => {
      const { data, error } = await supabase.from("lieferanten").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const produkte = useQuery({
    queryKey: ["lieferant-produkte", detailId],
    enabled: !!detailId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produkte")
        .select("*")
        .eq("lieferant_id", detailId!)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const anlegen = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("lieferanten").insert(form);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lieferant hinzugefügt");
      setModal(false);
      setForm(leer);
      qc.invalidateQueries({ queryKey: ["lieferanten"] });
    },
    onError: (e: Error) => toast.error(`Fehler: ${e.message}`),
  });

  const detail = (lieferanten.data ?? []).find((l) => l.id === detailId);

  const felder: [keyof typeof leer, string][] = [
    ["name", "Name"],
    ["kontaktperson", "Kontaktperson"],
    ["telefon", "Telefon"],
    ["email", "Email"],
    ["adresse", "Adresse"],
    ["kundennummer", "Kundennummer"],
    ["iban", "IBAN"],
  ];

  return (
    <div>
      <PageHeader
        title="Lieferanten"
        subtitle="Alle Partner und Kontaktdaten"
        action={
          <Button onClick={() => setModal(true)}>
            <Plus size={16} /> Lieferant hinzufügen
          </Button>
        }
      />

      <Card>
        {lieferanten.error ? (
          <Empty text={`Fehler: ${lieferanten.error.message}`} />
        ) : (lieferanten.data ?? []).length === 0 ? (
          <Empty text="Keine Lieferanten vorhanden." />
        ) : (
          <Table head={["Name", "Kontaktperson", "Telefon", "Email"]}>
            {(lieferanten.data ?? []).map((l) => (
              <Tr key={l.id} onClick={() => setDetailId(l.id)}>
                <Td>{l.name}</Td>
                <Td>{l.kontaktperson ?? "–"}</Td>
                <Td>{l.telefon ?? "–"}</Td>
                <Td>{l.email ?? "–"}</Td>
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
          <div className="grid grid-cols-2 gap-4">
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

      <Drawer open={!!detail} onClose={() => setDetailId(null)} title={detail?.name ?? "Lieferant"}>
        {detail && (
          <>
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Stammdaten
              </h3>
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
                        {num(Number(p.aktueller_bestand))} {p.einheit}
                      </span>
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