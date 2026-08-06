import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Mail, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { db } from "@/lib/db";
import {
  Badge,
  Button,
  Card,
  CardHeader,
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
import { setzePasswort } from "@/lib/gate";

export const Route = createFileRoute("/einstellungen")({
  head: () => ({
    meta: [
      { title: "Einstellungen — QUNO x CM Inventur" },
      { name: "description", content: "Kategorien verwalten, Passwort ändern, Gmail-Verbindung." },
      { property: "og:title", content: "Einstellungen — QUNO x CM Inventur" },
      { property: "og:description", content: "Kategorien verwalten, Passwort ändern, Gmail-Verbindung." },
    ],
  }),
  component: EinstellungenPage,
});

const leer = { id: "", name: "", typ: "getränk", farbe: "#3b82f6" };

function EinstellungenPage() {
  const qc = useQueryClient();
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(leer);
  const [neuesPw, setNeuesPw] = useState("");

  const kategorien = useQuery({
    queryKey: ["kategorien"],
    queryFn: async () => {
      const { data, error } = await db.from("kategorien").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const speichern = useMutation({
    mutationFn: async () => {
      const payload = { name: form.name, typ: form.typ, farbe: form.farbe };
      const res = form.id
        ? await db.from("kategorien").update(payload).eq("id", form.id)
        : await db.from("kategorien").insert(payload);
      if (res.error) throw res.error;
    },
    onSuccess: () => {
      toast.success("Kategorie gespeichert");
      setModal(false);
      setForm(leer);
      qc.invalidateQueries({ queryKey: ["kategorien"] });
    },
    onError: (e: Error) => toast.error(`Fehler: ${e.message}`),
  });

  const loeschen = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("kategorien").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Kategorie gelöscht");
      qc.invalidateQueries({ queryKey: ["kategorien"] });
    },
    onError: (e: Error) => toast.error(`Fehler: ${e.message}`),
  });

  return (
    <div className="max-w-4xl">
      <PageHeader title="Einstellungen" subtitle="Kategorien, Zugang und Verbindungen" />

      <Card>
        <CardHeader
          title="Kategorien"
          action={
            <Button
              className="px-3 py-1.5 text-xs"
              onClick={() => {
                setForm(leer);
                setModal(true);
              }}
            >
              <Plus size={14} /> Kategorie hinzufügen
            </Button>
          }
        />
        {kategorien.error ? (
          <Empty text={`Fehler: ${kategorien.error.message}`} />
        ) : (kategorien.data ?? []).length === 0 ? (
          <Empty text="Keine Kategorien vorhanden." />
        ) : (
          <Table head={["Name", "Typ", "Farbe", ""]}>
            {(kategorien.data ?? []).map((k) => (
              <Tr key={k.id}>
                <Td>
                  <span className="flex items-center gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: k.farbe }}
                    />
                    {k.name}
                  </span>
                </Td>
                <Td>
                  <Badge>{k.typ}</Badge>
                </Td>
                <Td className="text-muted-foreground">{k.farbe}</Td>
                <Td>
                  <span className="flex justify-end gap-3">
                    <button
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        setForm({ id: k.id, name: k.name, typ: k.typ, farbe: k.farbe });
                        setModal(true);
                      }}
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      className="text-muted-foreground hover:text-primary"
                      onClick={() => loeschen.mutate(k.id)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </span>
                </Td>
              </Tr>
            ))}
          </Table>
        )}
      </Card>

      <Card className="mt-6">
        <CardHeader title="Passwort ändern" />
        <form
          className="flex items-end gap-3 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (neuesPw.length < 4) {
              toast.error("Passwort zu kurz");
              return;
            }
            setzePasswort(neuesPw);
            setNeuesPw("");
            toast.success(
              "Passwort in diesem Browser geändert. Für alle Geräte muss es im Code angepasst werden.",
            );
          }}
        >
          <div className="w-72">
            <Field label="Neues Passwort">
              <Input
                type="password"
                value={neuesPw}
                onChange={(e) => setNeuesPw(e.target.value)}
                placeholder="Neues Passwort"
              />
            </Field>
          </div>
          <Button type="submit">Speichern</Button>
        </form>
        <p className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
          Hinweis: Das Passwort wird lokal in diesem Browser gespeichert. Damit es dauerhaft für
          alle gilt, muss der Standardwert im Code (src/lib/gate.ts) geändert werden.
        </p>
      </Card>

      <Card className="mt-6">
        <CardHeader title="Gmail-Verbindung" />
        <div className="flex items-center justify-between p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Mail size={16} />
            </span>
            <div>
              <div className="text-sm font-medium text-foreground">inventur.clubmichel@gmail.com</div>
              <div className="text-xs text-muted-foreground">
                Wird später für den automatischen Rechnungsimport genutzt.
              </div>
            </div>
          </div>
          <Badge tone="warning">Nicht verbunden</Badge>
        </div>
      </Card>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={form.id ? "Kategorie bearbeiten" : "Kategorie hinzufügen"}
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
          <Field label="Typ">
            <Select value={form.typ} onChange={(e) => setForm({ ...form, typ: e.target.value })}>
              <option value="getränk">Getränk</option>
              <option value="lebensmittel">Lebensmittel</option>
            </Select>
          </Field>
          <Field label="Farbe">
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={form.farbe}
                onChange={(e) => setForm({ ...form, farbe: e.target.value })}
                className="h-10 w-14 cursor-pointer rounded-lg border border-border bg-surface-2"
              />
              <Input
                value={form.farbe}
                onChange={(e) => setForm({ ...form, farbe: e.target.value })}
              />
            </div>
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setModal(false)}>
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