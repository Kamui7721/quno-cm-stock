import { createServerFn } from "@tanstack/react-start";

import { dbOpSchema } from "./db-schema";

export const dbRequest = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => dbOpSchema.parse(data))
  .handler(async ({ data }) => {
    const { runDbOp } = await import("./db.server");
    return runDbOp(data);
  });