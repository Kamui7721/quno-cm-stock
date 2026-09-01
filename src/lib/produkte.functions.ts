import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const bulkUpdateSchema = z.object({
  ids: z.array(z.string().uuid()).max(500),
  kategorie_id: z.string().uuid(),
});

export const bulkUpdateKategorie = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => bulkUpdateSchema.parse(data))
  .handler(async ({ data }) => {
    const { assertGate } = await import("./gate.server");
    assertGate();

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("produkte")
      .update({ kategorie_id: data.kategorie_id })
      .in("id", data.ids);

    if (error) throw new Error(error.message);
    return { ok: true, count: data.ids.length };
  });
