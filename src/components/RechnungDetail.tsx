import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { db } from "@/lib/db";
import { belegPfad, belegUrlHolen } from "@/lib/beleg";
import { pruefungSetzen } from "@/lib/pruefung";

import { Badge, Button, DetailModal, InfoRow } from "@/components/ui-kit";
import { datum, datumZeit, eur, num } from "@/lib/format";

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

          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Beleg
            </h3>
            {!belegPfad(r.pdf_url) ? (
              <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
                Kein Beleg hinterlegt
              </div>
            ) : beleg.isPending ? (
              <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
                Beleg wird geladen…
              </div>
            ) : beleg.error || !beleg.data ? (
              <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-danger/50 text-sm text-danger">
                Beleg konnte nicht geladen werden
              </div>
            ) : (
              <div className="space-y-2">
                <iframe
                  src={beleg.data}
                  title="Beleg-Vorschau"
                  className="h-[400px] w-full rounded-lg border border-border bg-surface-2"
                />
                <a href={beleg.data} target="_blank" rel="noreferrer">
                  <Button variant="outline">In neuem Tab öffnen</Button>
                </a>
                {r.pdf_dateiname && (
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
