/**
 * Rendert die erste Seite eines Belegs als PNG (ca. 800 px breit) und legt es
 * über die geschützte Server-Route im Bucket ab.
 *
 * Das Rendern passiert im Browser (Canvas). Die Server-Laufzeit der App ist eine
 * Edge-Umgebung ohne Canvas/Native-Module, dort ist Rasterisieren nicht möglich.
 */
const BREITE = 800;

async function pdfjsLaden() {
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  return pdfjs;
}

/** Erzeugt und speichert die Vorschau. Gibt false zurück, wenn es nicht geklappt hat. */
export async function vorschauErzeugen(rechnungId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/rechnung-pdf/${rechnungId}/datei`, { credentials: "include" });
    if (!res.ok) return false;
    const daten = new Uint8Array(await res.arrayBuffer());

    const pdfjs = await pdfjsLaden();
    const dokument = await pdfjs.getDocument({ data: daten }).promise;
    const seite = await dokument.getPage(1);

    const basis = seite.getViewport({ scale: 1 });
    const viewport = seite.getViewport({ scale: BREITE / basis.width });

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) return false;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await seite.render({ canvas, canvasContext: ctx as any, viewport } as any).promise;
    void dokument.cleanup();

    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
    if (!blob) return false;

    const upload = await fetch(`/api/rechnung-vorschau/${rechnungId}`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "image/png" },
      body: blob,
    });
    return upload.ok;
  } catch (e) {
    console.warn("[vorschau] Rendern fehlgeschlagen", e);
    return false;
  }

}
