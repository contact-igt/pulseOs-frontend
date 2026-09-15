import { and, eq } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import { conversations, messages, timelineEvents } from "../../db/schema.js";
import { findOrCreatePatientByPhone } from "../patient/identity.service.js";
import type { InboundMessageEvent, MessageStatusEvent } from "./types.js";

async function findOrCreateConversation(db: Db, tenantId: string, connectorId: string, patientId: string, externalThreadId: string, lastMessageAt: Date) {
  const [existing] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.connectorId, connectorId), eq(conversations.externalThreadId, externalThreadId)))
    .limit(1);
  if (existing) return existing;

  // No AI runtime exists yet in this checkpoint (Group U) — a brand-new
  // live conversation is never silently marked as AI-handled. It starts
  // HUMAN_REQUIRED so it surfaces in the triage queue for a real person.
  const [created] = await db
    .insert(conversations)
    .values({
      tenantId,
      patientId,
      channel: "WHATSAPP",
      connectorId,
      externalThreadId,
      ownershipState: "HUMAN_REQUIRED",
      lastMessageAt,
    })
    .returning();
  return created;
}

export async function processInboundWhatsAppMessage(db: Db, tenantId: string, connectorId: string, event: InboundMessageEvent): Promise<{ conversationId: string; patientId: string }> {
  const patient = await findOrCreatePatientByPhone(db, tenantId, event.fromPhone, event.fromName ?? "WhatsApp Contact");
  const conversation = await findOrCreateConversation(db, tenantId, connectorId, patient.id, event.externalThreadId, event.occurredAt);

  await db.insert(messages).values({
    tenantId,
    conversationId: conversation.id,
    senderType: "patient",
    body: event.body,
    sentAt: event.occurredAt,
    connectorId,
    providerMessageId: event.externalEventId,
  });

  await db
    .update(conversations)
    .set({ lastMessageAt: event.occurredAt })
    .where(eq(conversations.id, conversation.id));

  await db.insert(timelineEvents).values({
    tenantId,
    patientId: patient.id,
    journeyId: conversation.journeyId,
    actorType: "system",
    eventType: "whatsapp_message",
    title: "WhatsApp message received",
    description: event.body,
    sourceChannel: "whatsapp",
    occurredAt: event.occurredAt,
    relatedEntityType: "conversation",
    relatedEntityId: conversation.id,
  });

  return { conversationId: conversation.id, patientId: patient.id };
}

export async function processWhatsAppStatusUpdate(db: Db, connectorId: string, event: MessageStatusEvent): Promise<{ matched: boolean }> {
  const [existing] = await db
    .select({ id: messages.id })
    .from(messages)
    .where(and(eq(messages.connectorId, connectorId), eq(messages.providerMessageId, event.providerMessageId)))
    .limit(1);
  if (!existing) return { matched: false };

  await db.update(messages).set({ deliveryStatus: event.status }).where(eq(messages.id, existing.id));
  return { matched: true };
}
