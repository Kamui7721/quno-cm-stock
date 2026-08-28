import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, FileText, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { db } from "@/lib/db";
import { belegPfad, belegUrlHolen } from "@/lib/beleg";
import { vorschauErzeugen } from "@/lib/vorschau";
import { pruefungSetzen } from "@/lib/pruefung";


import { Badge, Button, DetailModal, InfoRow } from "@/components/ui-kit";
import { datum, datumZeit, einheitLabel, eur, num } from "@/lib/format";

type Props = {
  id: string | null;
  onClose: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onEdit?: ((rechnung: any) => void) | undefined;
};

export function RechnungDetail({ id, onClose, onEdit }: Props) {
  const qc = useQueryClient();

  const aktualisieren = () => {
    qc.invalidateQueries({ queryKey: ["rechnungen"] });
    qc.invalidateQueries({ queryKey: ["rechnung", id] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const rechnung = useQuery({
    queryKey: ["rechnung", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await db
        .from("rechnungen")
        .select("*, lieferanten(name)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const positionen = useQuery({
    queryKey: ["rechnungspositionen", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await db
        .from("rechnungspositionen")
        .select("*, kategorien(name, farbe)")
        .eq("rechnung_id", id!);
      if (error) throw error;
      return data;
    },
  });
  const beleg = useQuery({
    queryKey: ["beleg-url", id],
    enabled: !!id && !!belegPfad(rechnung.data?.pdf_url),
    staleTime: 30 * 60 * 1000,
    retry: false,
    queryFn: () => belegUrlHolen(id!),
  });

  const vorschau = useMutation({
    mutationFn: async () => {
      const ok = await vorschauErzeugen(id!);
      if (!ok) throw new Error("Vorschau konnte nicht erzeugt werden");
    },
    onSuccess: aktualisieren,
  });

  // Für Belege ohne Vorschau (z. B. per n8n hochgeladen) einmalig nachrendern.
  const versucht = useRef<string | null>(null);
  const r0 = rechnung.data;
  useEffect(() => {
    if (!id || !r0) return;
    if (!belegPfad(r0.pdf_url) || belegPfad(r0.pdf_vorschau)) return;
    if (versucht.current === id) return;
    versucht.current = id;
    vorschau.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, r0?.pdf_url, r0?.pdf_vorschau]);


  const bezahltToggle = useMutation({
    mutationFn: async (bezahlt: boolean) => {
      const { error } = await db.from("rechnungen").update({ bezahlt }).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: aktualisieren,
    onError: (e: Error) => toast.error(`Fehler: ${e.message}`),
  });

  const pruefToggle = useMutation({
    mutationFn: async (geprueft: boolean) => pruefungSetzen([id!], geprueft),
    onSuccess: (_d, geprueft) => {
      toast.success(geprueft ? "Als geprüft markiert" : "Prüfung zurückgesetzt");
      aktualisieren();
    },
    onError: (e: Error) => toast.error(`Fehler: ${e.message}`),
  });

  const loeschen = useMutation({
    mutationFn: async () => {
      const pos = await db.from("rechnungspositionen").delete().eq("rechnung_id", id!);
      if (pos.error) throw pos.error;
      const res = await db.from("rechnungen").delete().eq("id", id!);
      if (res.error) throw res.error;
    },
    onSuccess: () => {
      toast.success("Rechnung gelöscht");
      onClose();
      aktualisieren();
    },
    onError: (e: Error) => toast.error(`Fehler: ${e.message}`),
  });

  const [mengeEditId, setMengeEditId] = useState<string | null>(null);
  const [mengeWert, setMengeWert] = useState("");

  const mengeSpeichern = useMutation({
    mutationFn: async ({ posId, menge }: { posId: string; menge: number }) => {
      const { error } = await db.from("rechnungspositionen").update({ menge }).eq("id", posId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Menge aktualisiert");
      setMengeEditId(null);
      qc.invalidateQueries({ queryKey: ["rechnungspositionen", id] });
      qc.invalidateQueries({ queryKey: ["produkte"] });
      aktualisieren();
    },
    onError: (e: Error) => toast.error(`Fehler: ${e.message}`),
  });

  const r = rechnung.data;

  return (
    <DetailModal
      open={!!id}
      onClose={onClose}
      title={r ? `Rechnung ${r.rechnungsnummer}` : "Rechnung"}
      action={
        r && onEdit ? (
          <button
            type="button"
            aria-label="Rechnung bearbeiten"
            className="rounded-md p-1.5 text-muted-foreground transition hover:bg-surface-2 hover:text-foreground"
            onClick={() => onEdit(r)}
          >
            <Pencil size={16} />
          </button>
        ) : null
      }
      footer={
        r ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
            <Button
              variant={r.geprueft ? "outline" : "primary"}
              disabled={pruefToggle.isPending}
              onClick={() => pruefToggle.mutate(!r.geprueft)}
            >
              {r.geprueft ? "Prüfung zurücksetzen" : "Als geprüft markieren"}
            </Button>
            <Button
              variant="danger"
              disabled={loeschen.isPending}
              onClick={() => {
                if (
                  window.confirm(
                    "Rechnung wirklich löschen? Alle Positionen werden ebenfalls gelöscht.",
                  )
                ) {
                  loeschen.mutate();
                }
              }}
            >
              <Trash2 size={16} /> Löschen
            </Button>
          </div>
        ) : null
      }
    >
      {!r ? (
        <p className="text-sm text-muted-foreground">Lade Rechnung…</p>
      ) : (
        <>
          <div>
            <InfoRow label="Lieferant" value={r.lieferanten?.name ?? "–"} />
            <InfoRow label="Datum" value={datum(r.datum)} />
            <InfoRow label="Gesamtbetrag" value={eur(Number(r.gesamtbetrag))} />
            <InfoRow
              label="Status"
              value={
                <Badge
                  tone={r.bezahlt ? "success" : "warning"}
                  onClick={() => bezahltToggle.mutate(!r.bezahlt)}
                >
                  {r.bezahlt ? "bezahlt" : "offen"}
                </Badge>
              }
            />
            <InfoRow
              label="Prüfung"
              value={
                <Badge tone={r.geprueft ? "success" : "danger"}>
                  {r.geprueft ? "geprüft" : "nicht geprüft"}
                </Badge>
              }
            />
          </div>

          {r.import_warnungen?.trim() ? (
            <div className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-3">
              <h3 className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-warning">
                <AlertTriangle size={14} /> Hinweise zum Import
              </h3>
              <ul className="list-inside list-disc space-y-0.5 text-sm text-muted-foreground">
                {String(r.import_warnungen)
                  .split("|")
                  .map((w: string) => w.trim())
                  .filter(Boolean)
                  .map((w: string, i: number) => (
                    <li key={i}>{w}</li>
                  ))}
              </ul>
            </div>
          ) : null}

          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Positionen
            </h3>
            {(positionen.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine Positionen erfasst.</p>
            ) : (
              <div className="space-y-2">
                {(positionen.data ?? []).map((p) => (
                  <div
                    key={p.id}
                    className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">
                        {num(Number(p.menge))} {einheitLabel(p.einheit)} × {p.bezeichnung}
                      </span>
                      <div className="flex shrink-0 items-center gap-2">
                        <span>{eur(Number(p.preis))}</span>
                        {mengeEditId !== p.id && (
                          <button
                            type="button"
                            aria-label="Menge bearbeiten"
                            className="rounded-md p-1 text-muted-foreground transition hover:bg-surface hover:text-foreground"
                            onClick={() => {
                              setMengeEditId(p.id);
                              setMengeWert(String(p.menge ?? 0));
                            }}
                          >
                            <Pencil size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                    {mengeEditId === p.id && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <input
                          type="number"
                          inputMode="decimal"
                          step="any"
                          autoFocus
                          value={mengeWert}
                          onChange={(e) => setMengeWert(e.target.value)}
                          className="w-24 rounded-md border border-border bg-surface px-2 py-1 text-sm text-foreground outline-none focus:border-primary"
                        />
                        <span className="text-xs text-muted-foreground">
                          {einheitLabel(p.einheit)}
                        </span>
                        <Button
                          className="px-3 py-1 text-xs"
                          disabled={mengeSpeichern.isPending || mengeWert.trim() === ""}
                          onClick={() =>
                            mengeSpeichern.mutate({ posId: p.id, menge: Number(mengeWert) || 0 })
                          }
                        >
                          Speichern
                        </Button>
                        <Button
                          variant="outline"
                          className="px-3 py-1 text-xs"
                          onClick={() => setMengeEditId(null)}
                        >
                          Abbrechen
                        </Button>
                      </div>
                    )}
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

          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Beleg
            </h3>
            {!belegPfad(r.pdf_url) ? (
              <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
                Kein Beleg hinterlegt
              </div>
            ) : beleg.isPending ? (
              <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
                Beleg wird geladen…
              </div>
            ) : beleg.error || !beleg.data ? (
              <div className="rounded-xl border border-danger/50 bg-danger/10 px-3 py-3 text-sm text-danger">
                <p className="font-medium">Beleg konnte nicht geladen werden</p>
                <p className="mt-1 break-words text-xs">
                  {beleg.error instanceof Error ? beleg.error.message : "Unbekannter Fehler"}
                </p>
                <p className="mt-1 break-all text-xs text-muted-foreground">
                  Gespeicherter Pfad: {belegPfad(r.pdf_url)}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {belegPfad(r.pdf_vorschau) ? (
                  <a
                    href={beleg.data}
                    target="_blank"
                    rel="noreferrer"
                    className="group relative block overflow-hidden rounded-xl border border-border bg-surface-2"
                  >
                    <img
                      src={`/api/rechnung-vorschau/${id}`}
                      alt="Vorschau der ersten Belegseite"
                      loading="lazy"
                      className="h-[340px] w-full object-cover object-top"
                    />
                    <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-sm font-medium text-transparent transition group-hover:bg-black/45 group-hover:text-white">
                      Beleg öffnen
                    </span>
                  </a>
                ) : (
                  <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-surface-2 px-4 py-8 text-center">
                    <FileText size={32} className="text-accent" />
                    <p className="text-sm text-muted-foreground">
                      {r.pdf_dateiname ?? "Beleg als PDF hinterlegt"}
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <a href={beleg.data} target="_blank" rel="noreferrer">
                        <Button variant="outline">Beleg öffnen</Button>
                      </a>
                      <Button
                        variant="outline"
                        disabled={vorschau.isPending}
                        onClick={() => vorschau.mutate()}
                      >
                        {vorschau.isPending ? "Erzeuge Vorschau…" : "Vorschau erzeugen"}
                      </Button>
                    </div>
                  </div>
                )}
                {r.pdf_dateiname && belegPfad(r.pdf_vorschau) && (
                  <p className="text-xs text-muted-foreground">{r.pdf_dateiname}</p>
                )}
              </div>
            )}
          </div>





          <div className="border-t border-border pt-4 text-xs text-muted-foreground">
            <p>Hinzugefügt am {datumZeit(r.erstellt_am)}</p>
            <p className="mt-0.5">
              {r.gmail_message_id ? "Automatisch per E-Mail importiert" : "Manuell erfasst"}
            </p>
            {r.geprueft && (
              <p className="mt-0.5">
                Geprüft am {datum(r.geprueft_am)}
                {r.geprueft_von ? ` von ${r.geprueft_von}` : ""}
              </p>
            )}
          </div>
        </>
      )}
    </DetailModal>
  );
}
