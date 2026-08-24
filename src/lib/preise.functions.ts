import { createServerFn } from "@tanstack/react-start";

/** Berechnet die Preisdaten (letzter EK, Ø EK) für alle Produkte neu. */
export const preisdatenNeuBerechnen = createServerFn({ method: "POST" }).handler(async () => {
  const { assertGate } = await import("./gate.server");
  assertGate();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabaseAdmin as any).rpc("preisdaten_neu_berechnen");
  if (error) throw new Error(error.message);
  return { anzahl: Number(data ?? 0) };
});
