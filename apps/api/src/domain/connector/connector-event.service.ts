import { and, eq } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import { connectorEvents } from "../../db/schema.js";

export interface RecordEventInput {
  tenantId: string;
  connectorId: string;
  externalEventId: string;
  direction: "inbound" | "outbound";
  payload?: unknown;
}

// The unique (connectorId, externalEventId) index is the actual idempotency
// guard. A second webhook delivery for the same provider event id hits the
// unique-violation path and is recorded/returned as a duplicate rather than
// reprocessed — callers should skip all further side effects when duplicate
// is true.
export async function recordConnectorEvent(db: Db, input: RecordEventInput): Promise<{ eventId: string; duplicate: boolean }> {
  const [existing] = await db
    .select({ id: connectorEvents.id })
    .from(connectorEvents)
    .where(and(eq(connectorEvents.connectorId, input.connectorId), eq(connectorEvents.externalEventId, input.externalEventId)))
    .limit(1);

  if (existing) {
    return { eventId: existing.id, duplicate: true };
  }

  try {
    const [row] = await db
      .insert(connectorEvents)
      .values({
        tenantId: input.tenantId,
        connectorId: input.connectorId,
        externalEventId: input.externalEventId,
        direction: input.direction,
        status: "received",
        payload: input.payload,
      })
      .returning({ id: connectorEvents.id });
    return { eventId: row.id, duplicate: false };
  } catch {
    // Race: two concurrent deliveries of the same event both passed the SELECT
    // above before either INSERT committed. The unique index still protects
    // us — treat the loser as a duplicate rather than surfacing a 500.
    const [row] = await db
      .select({ id: connectorEvents.id })
      .from(connectorEvents)
      .where(and(eq(connectorEvents.connectorId, input.connectorId), eq(connectorEvents.externalEventId, input.externalEventId)))
      .limit(1);
    return { eventId: row!.id, duplicate: true };
  }
}

export async function markEventProcessed(db: Db, eventId: string): Promise<void> {
  await db.update(connectorEvents).set({ status: "processed", processedAt: new Date() }).where(eq(connectorEvents.id, eventId));
}

export async function markEventFailed(db: Db, eventId: string, error: string): Promise<void> {
  await db.update(connectorEvents).set({ status: "failed", error, processedAt: new Date() }).where(eq(connectorEvents.id, eventId));
}
