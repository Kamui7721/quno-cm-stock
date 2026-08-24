import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Mail, Pencil, Plus, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { db } from "@/lib/db";
import {
  PREISALARM_SCHLUESSEL,
  einstellungSpeichern,
  preisalarmSchwelleLaden,
} from "@/lib/einstellungen";
import { preisdatenNeuBerechnen } from "@/lib/preise.functions";
import { resetAusfuehrenFn, resetZahlenLaden } from "@/lib/reset.functions";
import { PRODUKT_SCHWELLE, bezeichnungAehnlichkeit } from "@/lib/aehnlichkeit";
import { vorschauErzeugen } from "@/lib/vorschau";

import { produkteZusammenfuehren } from "@/lib/produkt-merge";

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

export const Route = createFileRoute("/einstellungen")({
  head: () => ({
    meta: [
      { title: "Einstellungen — QUNO x CM Inventur" },
      { name: "description", content: "Kategorien verwalten, Passwort ändern, Gmail-Verbindung." },
      { property: "og:title", content: "Einstellungen — QUNO x CM Inventur" },
      {
        property: "og:description",
        content: "Kategorien verwalten, Passwort ändern, Gmail-Verbindung.",
      },
    ],
  }),
  component: EinstellungenPage,
});

const leer = { id: "", name: "", typ: "getränk", farbe: "#3b82f6" };

type Dublette = {
  key: string;
  zielId: string;
  quelleId: string;
  zielName: string;
  quelleName: string;
  score: number;
};

function EinstellungenPage() {
  const qc = useQueryClient();
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(leer);
  const [neuesPw, setNeuesPw] = useState("");
  const [schwelleInput, setSchwelleInput] = useState("10");
  const [paare, setPaare] = useState<Dublette[] | null>(null);
  const [gewaehlt, setGewaehlt] = useState<string[]>([]);
  const [resetBereich, setResetBereich] = useState<ResetBereich | null>(null);
  const [resetZahlen, setResetZahlen] = useState<string | null>(null);
  const [resetWort, setResetWort] = useState("");

  const resetOeffnen = useMutation({
    mutationFn: async (bereich: ResetBereich) => {
      const zahlen = await resetZahlenLaden({ data: { bereich } });
      return { bereich, text: zahlenText(zahlen) };
    },
    onSuccess: ({ bereich, text }) => {
      setResetBereich(bereich);
      setResetZahlen(text);
      setResetWort("");
    },
    onError: (e: Error) => toast.error(`Fehler: ${e.message}`),
  });

  const resetStarten = useMutation({
    mutationFn: async (bereich: ResetBereich) => resetAusfuehrenFn({ data: { bereich } }),
    onSuccess: (res) => {
      setResetBereich(null);
      setResetWort("");
      toast.success(`Gelöscht: ${zahlenText(res.zahlen)}`);
      if (res.verbliebeneDateien.length) {
        toast.warning(
          `${res.verbliebeneDateien.length} Datei(en) konnten nicht gelöscht werden: ${res.verbliebeneDateien.join(", ")}`,
        );
      }
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(`Fehler: ${e.message}`),
  });



  const dublettenSuche = useMutation({
    mutationFn: async (): Promise<Dublette[]> => {
      const { data, error } = await db.from("produkte").select("id, name").order("name");
      if (error) throw new Error(error.message);
      const liste = (data ?? []) as Array<{ id: string; name: string }>;
      const gefunden: Dublette[] = [];
      const verbraucht = new Set<string>();
      for (let i = 0; i < liste.length; i++) {
        const a = liste[i]!;
        if (verbraucht.has(a.id)) continue;
        for (let j = i + 1; j < liste.length; j++) {
          const b = liste[j]!;
          if (verbraucht.has(b.id)) continue;
          const score = bezeichnungAehnlichkeit(a.name, b.name);
          if (score >= PRODUKT_SCHWELLE) {
            verbraucht.add(b.id);
            gefunden.push({
              key: `${a.id}:${b.id}`,
              zielId: a.id,
              quelleId: b.id,
              zielName: a.name,
              quelleName: b.name,
              score,
            });
          }
        }
      }
      return gefunden.sort((x, y) => y.score - x.score);
    },
    onSuccess: (res) => {
      setPaare(res);
      setGewaehlt([]);
      toast.success(res.length ? `${res.length} mögliche Dublette(n) gefunden` : "Keine Dubletten gefunden");
    },
    onError: (e: Error) => toast.error(`Fehler: ${e.message}`),
  });

  const zusammenfuehren = useMutation({
    mutationFn: async () => {
      const auswahl = (paare ?? []).filter((p) => gewaehlt.includes(p.key));
      for (const p of auswahl) {
        await produkteZusammenfuehren(p.zielId, p.quelleId);
      }
      return auswahl.length;
    },
    onSuccess: (anzahl) => {
      toast.success(`${anzahl} Paar(e) zusammengeführt`);
      setPaare((alt) => (alt ?? []).filter((p) => !gewaehlt.includes(p.key)));
      setGewaehlt([]);
      qc.invalidateQueries({ queryKey: ["produkte"] });
    },
    onError: (e: Error) => toast.error(`Fehler: ${e.message}`),
  });

  const vorschauenErzeugen = useMutation({
    mutationFn: async () => {
      const { data, error } = await db
        .from("rechnungen")
        .select("id, pdf_url, pdf_vorschau");
      if (error) throw new Error(error.message);
      const offen = ((data ?? []) as Array<{
        id: string;
        pdf_url: string | null;
        pdf_vorschau: string | null;
      }>).filter((r) => (r.pdf_url ?? "").trim() && !(r.pdf_vorschau ?? "").trim());

      let erfolg = 0;
      for (const r of offen) {
        if (await vorschauErzeugen(r.id)) erfolg += 1;
      }
      return { erfolg, gesamt: offen.length };
    },
    onSuccess: ({ erfolg, gesamt }) => {
      toast.success(
        gesamt === 0
          ? "Alle Belege haben bereits eine Vorschau"
          : `${erfolg} von ${gesamt} Vorschau(en) erzeugt`,
      );
      qc.invalidateQueries({ queryKey: ["rechnungen"] });
    },
    onError: (e: Error) => toast.error(`Fehler: ${e.message}`),
  });


  useQuery({
    queryKey: ["preisalarm-schwelle"],
    queryFn: async () => {
      const wert = await preisalarmSchwelleLaden();
      setSchwelleInput(String(wert));
      return wert;
    },
  });

  const schwelleSpeichern = useMutation({
    mutationFn: async () => {
      const n = Number(schwelleInput.replace(",", "."));
      if (!Number.isFinite(n) || n <= 0) throw new Error("Bitte einen Wert größer als 0 angeben");
      await einstellungSpeichern(PREISALARM_SCHLUESSEL, String(n));
    },
    onSuccess: () => {
      toast.success("Schwellenwert gespeichert");
      qc.invalidateQueries({ queryKey: ["preisalarm-schwelle"] });
    },
    onError: (e: Error) => toast.error(`Fehler: ${e.message}`),
  });

  const neuBerechnen = useMutation({
    mutationFn: async () => preisdatenNeuBerechnen(),
    onSuccess: (res) => {
      toast.success(`Preisdaten für ${res.anzahl} Produkte neu berechnet`);
      qc.invalidateQueries({ queryKey: ["produkte"] });
      qc.invalidateQueries({ queryKey: ["preisalarm-produkte"] });
    },
    onError: (e: Error) => toast.error(`Fehler: ${e.message}`),
  });

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
        <CardHeader title="Preisauswertung" />
        <div className="space-y-4 p-5">
          <Field label="Preisalarm-Schwelle (%)">
            <div className="flex items-center gap-3">
              <Input
                type="number"
                min="1"
                step="1"
                className="w-32"
                value={schwelleInput}
                onChange={(e) => setSchwelleInput(e.target.value)}
              />
              <Button
                variant="outline"
                disabled={schwelleSpeichern.isPending}
                onClick={() => schwelleSpeichern.mutate()}
              >
                Speichern
              </Button>
            </div>
          </Field>
          <p className="text-xs text-muted-foreground">
            Produkte, deren letzter Einkaufspreis um mehr als diesen Wert vom Durchschnitt der
            letzten 12 Monate abweicht, erscheinen im Dashboard unter „Preisveränderungen“.
          </p>
          <button
            type="button"
            disabled={neuBerechnen.isPending}
            onClick={() => neuBerechnen.mutate()}
            className="text-xs text-muted-foreground underline transition hover:text-foreground disabled:opacity-50"
          >
            {neuBerechnen.isPending ? "Berechne..." : "Preisdaten neu berechnen"}
          </button>
        </div>
      </Card>

      <Card className="mt-6">
        <CardHeader
          title="Produktdubletten"
          action={
            <Button
              variant="outline"
              className="px-3 py-1.5 text-xs"
              disabled={dublettenSuche.isPending}
              onClick={() => dublettenSuche.mutate()}
            >
              {dublettenSuche.isPending ? "Suche…" : "Produktdubletten finden"}
            </Button>
          }
        />
        <div className="space-y-3 p-5">
          {paare === null ? (
            <p className="text-xs text-muted-foreground">
              Sucht Produkte mit über 85 % Ähnlichkeit der normalisierten Bezeichnung. Die Auswahl
              wird erst nach Bestätigung zusammengeführt.
            </p>
          ) : paare.length === 0 ? (
            <p className="text-xs text-muted-foreground">Keine Dubletten gefunden.</p>
          ) : (
            <>
              {paare.map((p) => (
                <label
                  key={p.key}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm"
                >
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 accent-primary"
                    checked={gewaehlt.includes(p.key)}
                    onChange={(e) =>
                      setGewaehlt((g) =>
                        e.target.checked ? [...g, p.key] : g.filter((x) => x !== p.key),
                      )
                    }
                  />
                  <span>
                    <span className="block text-foreground">
                      {p.zielName} <span className="text-muted-foreground">←</span> {p.quelleName}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Ähnlichkeit {Math.round(p.score * 100)} % · behalten wird „{p.zielName}“
                    </span>
                  </span>
                </label>
              ))}
              <div className="flex justify-end">
                <Button
                  disabled={!gewaehlt.length || zusammenfuehren.isPending}
                  onClick={() => zusammenfuehren.mutate()}
                >
                  {zusammenfuehren.isPending
                    ? "Führe zusammen…"
                    : `${gewaehlt.length} Paar(e) zusammenführen`}
                </Button>
              </div>
            </>
          )}
        </div>
      </Card>

      <Card className="mt-6">
        <CardHeader
          title="Beleg-Vorschauen"
          action={
            <Button
              variant="outline"
              className="px-3 py-1.5 text-xs"
              disabled={vorschauenErzeugen.isPending}
              onClick={() => vorschauenErzeugen.mutate()}
            >
              {vorschauenErzeugen.isPending ? "Erzeuge…" : "Beleg-Vorschauen erzeugen"}
            </Button>
          }
        />
        <p className="p-5 text-xs text-muted-foreground">
          Erzeugt für alle Rechnungen mit hinterlegtem PDF, denen noch ein Vorschaubild fehlt, die
          erste Seite als Bild (800 px). Bereits vorhandene Vorschauen bleiben unverändert.
        </p>
      </Card>


      <Card className="mt-6">

        <CardHeader title="Passwort" />
        <p className="p-5 text-xs text-muted-foreground">
          Das Zugangspasswort wird aus Sicherheitsgründen ausschließlich auf dem Server geprüft und
          ist im Browser nicht sichtbar. Es kann über das Server-Geheimnis
          <span className="mx-1 font-mono text-foreground">APP_PASSWORT</span>
          geändert werden — sage einfach Bescheid, wenn ein neues Passwort gesetzt werden soll.
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
              <div className="text-sm font-medium text-foreground">
                inventur.clubmichel@gmail.com
              </div>
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
