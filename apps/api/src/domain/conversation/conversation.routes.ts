import type { FastifyInstance } from "fastify";
import type { ConversationChannel, OwnershipState } from "@pulseos/types";
import { requirePermission } from "../auth/permission.middleware.js";
import {
  assignConversation,
  claimConversation,
  getConversationDetail,
  listConversations,
  returnConversationToAi,
  sendMessage,
} from "./conversation.service.js";

const REASON_STATUS: Record<string, number> = {
  conversation_not_found: 404,
  conversation_closed: 409,
};

export async function conversationRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requirePermission("VIEW_INBOX"));

  app.get("/conversations", async (request) => {
    const tenantId = request.sessionUser!.tenantId;
    const query = request.query as { channel?: ConversationChannel; ownershipState?: OwnershipState; search?: string };
    return listConversations(app.db, tenantId, query);
  });

  app.get("/conversations/:id", async (request, reply) => {
    const tenantId = request.sessionUser!.tenantId;
    const { id } = request.params as { id: string };
    const detail = await getConversationDetail(app.db, tenantId, id);
    if (!detail) return reply.status(404).send({ error: "conversation_not_found" });
    return detail;
  });

  app.post("/conversations/:id/messages", { preHandler: requirePermission("MANAGE_INBOX") }, async (request, reply) => {
    const tenantId = request.sessionUser!.tenantId;
    const actorId = request.sessionUser!.id;
    const { id } = request.params as { id: string };
    const { body } = request.body as { body: string };
    const result = await sendMessage(app.db, tenantId, id, actorId, body);
    if (!result.ok) return reply.status(REASON_STATUS[result.reason] ?? 400).send({ error: result.reason });
    return result;
  });

  app.patch("/conversations/:id/claim", { preHandler: requirePermission("MANAGE_INBOX") }, async (request, reply) => {
    const tenantId = request.sessionUser!.tenantId;
    const actorId = request.sessionUser!.id;
    const { id } = request.params as { id: string };
    const result = await claimConversation(app.db, tenantId, id, actorId);
    if (!result.ok) return reply.status(REASON_STATUS[result.reason] ?? 400).send({ error: result.reason });
    return result;
  });

  app.patch("/conversations/:id/assign", { preHandler: requirePermission("MANAGE_INBOX") }, async (request, reply) => {
    const tenantId = request.sessionUser!.tenantId;
    const actorId = request.sessionUser!.id;
    const { id } = request.params as { id: string };
    const { assignedTo } = request.body as { assignedTo: string };
    const result = await assignConversation(app.db, tenantId, id, actorId, assignedTo);
    if (!result.ok) return reply.status(REASON_STATUS[result.reason] ?? 400).send({ error: result.reason });
    return result;
  });

  app.patch("/conversations/:id/return-to-ai", { preHandler: requirePermission("MANAGE_INBOX") }, async (request, reply) => {
    const tenantId = request.sessionUser!.tenantId;
    const actorId = request.sessionUser!.id;
    const { id } = request.params as { id: string };
    const result = await returnConversationToAi(app.db, tenantId, id, actorId);
    if (!result.ok) return reply.status(REASON_STATUS[result.reason] ?? 400).send({ error: result.reason });
    return result;
  });
}
