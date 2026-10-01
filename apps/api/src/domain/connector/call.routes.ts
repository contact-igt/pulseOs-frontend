import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { hasPermission } from "@pulseos/types";
import { requirePermission } from "../auth/permission.middleware.js";
import { getCallRecordingUrl } from "./call-webhook.service.js";

const idSchema = z.string().uuid();
const querySchema = z.object({ download: z.enum(["1", "true"]).optional() });

// The provider's recording URL is only ever returned here, to a caller allowed to play (or, for a download,
// to download) it — never inside patient/journey payloads. A hospital-level decision about which roles hold
// these permissions is a later settings module; today Super Admin and Admin hold them, Staff and Doctor do not.
export async function callRoutes(app: FastifyInstance) {
  app.get("/calls/:id/recording", { preHandler: requirePermission("VIEW_CALL_RECORDING") }, async (request, reply) => {
    const id = idSchema.safeParse((request.params as { id: string }).id);
    const query = querySchema.safeParse(request.query);
    if (!id.success || !query.success) return reply.status(404).send({ error: "recording_not_found" });
    const download = query.data.download !== undefined;
    if (download) {
      // Downloading is a stricter capability than listening.
      if (!hasPermission(request.sessionUser!.role, "DOWNLOAD_CALL_RECORDING")) return reply.status(403).send({ error: "forbidden", requiredPermission: "DOWNLOAD_CALL_RECORDING" });
    }
    const url = await getCallRecordingUrl(app.db, request.sessionUser!.tenantId, id.data);
    if (!url) return reply.status(404).send({ error: "recording_not_found" });
    return { url, download };
  });
}
