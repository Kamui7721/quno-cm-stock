import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const bereichSchema = z.object({
  bereich: z.enum(["zaehlungen", "rechnungen", "produkte"]),
});

/** Zählt, was gelöscht würde — verändert keine Daten. */
export const resetZahlenLaden = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => bereichSchema.parse(data))
  .handler(async ({ data }) => {
    const { resetVorschau } = await import("./reset.server");
    return resetVorschau(data.bereich);
  });

/** Führt das Zurücksetzen aus. */
export const resetAusfuehrenFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => bereichSchema.parse(data))
  .handler(async ({ data }) => {
    const { resetAusfuehren } = await import("./reset.server");
    return resetAusfuehren(data.bereich);
  });
