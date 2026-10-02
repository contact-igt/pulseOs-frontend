import { and, desc, eq, sql } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import { connectorEvents, connectors, connectorSecrets, outboundWebhookDeliveries, outboundWebhooks } from "../../db/schema.js";
import { decryptSecret, encryptSecret } from "../security/encryption.js";
import { inLocalRange, isRealDate, tenantTimezone } from "../../lib/hospital-time.js";
import { hasPermission, type CapabilityMap, type IntegrationCard, type IntegrationDetail, type IntegrationLogRow, type Role } from "@pulseos/types";
import { redactLogText } from "../security/redact.js";
import { INTEGRATION_CATALOGUE, catalogueEntry, type CatalogueEntry } from "./hub-catalogue.js";
import { deriveConfiguration, deriveHealth, deriveMode, type ConnectorFacts } from "./hub-state.js";

type ConnectorRowT = typeof connectors.$inferSelect;
type Result<T> = ({ ok: true } & T) | { ok: false; reason: string };

async function loadFacts(db: Db, tenantId: string): Promise<Map<string, { row: ConnectorRowT; facts: ConnectorFacts }>> {
  const rows = await db.select().from(connectors).where(eq(connectors.tenantId, tenantId));
  const out = new Map<string, { row: ConnectorRowT; facts: ConnectorFacts }>();
  for (const row of rows) {
    const [secret] = await db.select().from(connectorSecrets).where(eq(connectorSecrets.connectorId, row.id)).limit(1);
    let secretKeys: string[] = [];
    if (secret) {
      try {
        // Only the NAMES of stored secrets leave this function, never a value.
        secretKeys = Object.entries(decryptSecret(secret.encryptedPayload)).filter(([, v]) => v !== "" && v != null).map(([k]) => k);
      } catch {
        secretKeys = [];
      }
    }
    out.set(row.provider, { row, facts: { status: row.status, mode: row.mode, configuration: (row.configuration as Record<string, unknown> | null) ?? null, secretKeys } });
  }
  return out;
}

function card(entry: CatalogueEntry, caps: CapabilityMap, role: Role, found: { row: ConnectorRowT; facts: ConnectorFacts } | undefined, webhookCount: number): IntegrationCard {
  const facts = found?.facts ?? null;
  const enabled = entry.capability ? caps[entry.capability] : true;
  let configuration = deriveConfiguration(entry, facts);
  if (entry.key === "webhooks") configuration = webhookCount > 0 ? "CONFIGURED" : "NOT_CONFIGURED";
  const mode = entry.key === "webhooks" ? (webhookCount > 0 ? "LIVE_CONFIGURED" : "NOT_CONFIGURED") : deriveMode(entry, enabled, configuration, facts);
  return {
    key: entry.key,
    category: entry.category,
    name: entry.name,
    provider: entry.provider,
    purpose: entry.purpose,
    capability: entry.capability,
    enabled,
    configuration,
    health: deriveHealth(entry, facts),
    mode,
    blockedReason: entry.blockedReason,
    lastSyncAt: found?.row.lastSyncAt?.toISOString() ?? null,
    lastEventAt: found?.row.lastEventAt?.toISOString() ?? null,
    lastError: found?.row.lastError ?? null,
    // Webhooks and credentials are Super Admin territory; operational settings are Admin and Super Admin.
    canConfigure: entry.key === "webhooks" ? hasPermission(role, "MANAGE_INTEGRATION_SECRETS") : !entry.blockedReason && hasPermission(role, "MANAGE_INTEGRATION_CONFIG"),
    canManageSecrets: !entry.blockedReason && hasPermission(role, "MANAGE_INTEGRATION_SECRETS"),
  };
}

export async function listHub(db: Db, tenantId: string, role: Role, caps: CapabilityMap): Promise<IntegrationCard[]> {
  const facts = await loadFacts(db, tenantId);
  const [{ n }] = (await db.select({ n: sql<number>`count(*)::int` }).from(outboundWebhooks).where(eq(outboundWebhooks.tenantId, tenantId))) as [{ n: number }];
  return INTEGRATION_CATALOGUE.map((e) => card(e, caps, role, e.connectorProvider ? facts.get(e.connectorProvider) : undefined, n));
}

export async function getHubDetail(db: Db, tenantId: string, role: Role, caps: CapabilityMap, key: string): Promise<IntegrationDetail | null> {
  const entry = catalogueEntry(key);
  if (!entry) return null;
  const facts = await loadFacts(db, tenantId);
  const found = entry.connectorProvider ? facts.get(entry.connectorProvider) : undefined;
  const [{ n }] = (await db.select({ n: sql<number>`count(*)::int` }).from(outboundWebhooks).where(eq(outboundWebhooks.tenantId, tenantId))) as [{ n: number }];
  const base = card(entry, caps, role, found, n);
  const config = found?.facts.configuration ?? {};
  const base_ = process.env.PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "";
  const webhookPath = found && entry.key === "whatsapp_meta_cloud" ? `/webhooks/whatsapp/${found.row.id}` : found && entry.key === "runo" ? `/webhooks/runo/${found.row.id}` : null;
  return {
    ...base,
    configurationFields: entry.configurationFields,
    configurationValues: Object.fromEntries(entry.configurationFields.map((f) => [f.key, config[f.key] == null ? "" : String(config[f.key])])),
    secretFields: entry.secretFields.map((f) => ({ ...f, hasSecret: !!found?.facts.secretKeys.includes(f.key) })),
    mappingNotes: entry.mappingNotes,
    webhookUrl: webhookPath ? `${base_}${webhookPath}` : null,
    connectorMode: found?.row.mode ?? null,
  };
}

/** The connectors row behind a catalogue entry, created on first configuration (FIXTURE until a Super Admin says otherwise). */
async function ensureConnector(db: Db, tenantId: string, entry: CatalogueEntry): Promise<ConnectorRowT | null> {
  if (!entry.connectorProvider || !entry.connectorType) return null;
  const [existing] = await db.select().from(connectors).where(and(eq(connectors.tenantId, tenantId), eq(connectors.provider, entry.connectorProvider))).limit(1);
  if (existing) return existing;
  const [created] = await db
    .insert(connectors)
    .values({ tenantId, type: entry.connectorType, provider: entry.connectorProvider, displayName: entry.name, capabilities: entry.connectorCapabilities, status: "NOT_CONFIGURED", mode: "FIXTURE", configuration: {} })
    .onConflictDoNothing()
    .returning();
  if (created) return created;
  const [again] = await db.select().from(connectors).where(and(eq(connectors.tenantId, tenantId), eq(connectors.provider, entry.connectorProvider))).limit(1);
  return again ?? null;
}

export interface ConfigureInput {
  configuration?: Record<string, string>;
  secrets?: Record<string, string>;
  mode?: "FIXTURE" | "SANDBOX" | "LIVE";
}

/**
 * Save settings for one integration. Permission split is enforced by the caller (secrets and mode: Super Admin);
 * unknown field names are refused so a request can never write arbitrary keys. Secrets MERGE into what is stored
 * (a blank value leaves that secret untouched) and are never echoed back.
 */
export async function configureIntegration(db: Db, tenantId: string, key: string, input: ConfigureInput): Promise<Result<object>> {
  const entry = catalogueEntry(key);
  if (!entry) return { ok: false, reason: "unknown_integration" };
  if (entry.blockedReason || !entry.connectorProvider) return { ok: false, reason: "blocked" };
  const connector = await ensureConnector(db, tenantId, entry);
  if (!connector) return { ok: false, reason: "blocked" };

  const configKeys = new Set(entry.configurationFields.map((f) => f.key));
  const secretKeys = new Set(entry.secretFields.map((f) => f.key));
  for (const k of Object.keys(input.configuration ?? {})) if (!configKeys.has(k)) return { ok: false, reason: "unknown_field" };
  for (const k of Object.keys(input.secrets ?? {})) if (!secretKeys.has(k)) return { ok: false, reason: "unknown_field" };

  let configuration = (connector.configuration as Record<string, unknown> | null) ?? {};
  if (input.configuration) {
    configuration = { ...configuration };
    for (const [k, v] of Object.entries(input.configuration)) {
      if (v.trim() === "") delete configuration[k];
      else configuration[k] = v.trim();
    }
  }

  const [stored] = await db.select().from(connectorSecrets).where(eq(connectorSecrets.connectorId, connector.id)).limit(1);
  let secretsNow: Record<string, unknown> = stored ? decryptSecret(stored.encryptedPayload) : {};
  if (input.secrets) {
    secretsNow = { ...secretsNow };
    for (const [k, v] of Object.entries(input.secrets)) if (v.trim() !== "") secretsNow[k] = v.trim();
    const encryptedPayload = encryptSecret(secretsNow);
    await db.insert(connectorSecrets).values({ connectorId: connector.id, encryptedPayload }).onConflictDoUpdate({ target: connectorSecrets.connectorId, set: { encryptedPayload, updatedAt: new Date() } });
  }

  const mode = input.mode ?? connector.mode;
  const complete =
    entry.requiredConfig.every((k) => configuration[k] != null && String(configuration[k]) !== "") && entry.requiredSecrets.every((k) => secretsNow[k] != null && secretsNow[k] !== "");
  // Configured is NOT connected: a fully configured connector waits (CONNECTING) until a real event or sync confirms it.
  const status = connector.status === "CONNECTED" || connector.status === "ERROR" || connector.status === "DEGRADED" ? connector.status : complete ? "CONNECTING" : "NOT_CONFIGURED";
  await db.update(connectors).set({ configuration, mode, status, updatedAt: new Date() }).where(eq(connectors.id, connector.id));
  return { ok: true };
}

// -- Logs -------------------------------------------------------------------

export interface LogFilters {
  provider?: string;
  status?: string;
  from?: string;
  to?: string;
}

export async function listIntegrationLogs(db: Db, tenantId: string, filters: LogFilters, limit = 100): Promise<IntegrationLogRow[]> {
  const tz = await tenantTimezone(db, tenantId);
  const range = filters.from && filters.to && isRealDate(filters.from) && isRealDate(filters.to) ? { from: filters.from, to: filters.to } : null;
  const rows: IntegrationLogRow[] = [];

  if (!filters.provider || (filters.provider !== "webhooks" && catalogueEntry(filters.provider))) {
    const entry = filters.provider ? catalogueEntry(filters.provider) : null;
    const cond = [eq(connectorEvents.tenantId, tenantId)];
    if (entry?.connectorProvider) cond.push(eq(connectors.provider, entry.connectorProvider));
    if (filters.status && ["received", "processed", "failed", "duplicate"].includes(filters.status)) cond.push(eq(connectorEvents.status, filters.status as "received"));
    if (range) cond.push(inLocalRange(connectorEvents.receivedAt, tz, range.from, range.to));
    const events = await db
      .select({ e: connectorEvents, provider: connectors.provider })
      .from(connectorEvents)
      .innerJoin(connectors, eq(connectors.id, connectorEvents.connectorId))
      .where(and(...cond))
      .orderBy(desc(connectorEvents.receivedAt))
      .limit(limit);
    for (const { e, provider } of events) {
      const type = (e.payload as { type?: string } | null)?.type;
      rows.push({ id: e.id, provider, direction: e.direction, status: e.status, summary: type ? `${type} event` : "event", error: redactLogText(e.error), at: e.receivedAt.toISOString() });
    }
  }

  if (!filters.provider || filters.provider === "webhooks") {
    const cond = [eq(outboundWebhookDeliveries.tenantId, tenantId)];
    if (filters.status) {
      const map: Record<string, string> = { sent: "SENT", failed: "FAILED", pending: "PENDING" };
      if (!map[filters.status]) cond.push(sql`false`);
      else cond.push(eq(outboundWebhookDeliveries.status, map[filters.status]!));
    }
    if (range) cond.push(inLocalRange(outboundWebhookDeliveries.createdAt, tz, range.from, range.to));
    const deliveries = await db.select().from(outboundWebhookDeliveries).where(and(...cond)).orderBy(desc(outboundWebhookDeliveries.createdAt)).limit(limit);
    for (const d of deliveries) {
      rows.push({ id: d.id, provider: "webhooks", direction: "outbound", status: d.status === "SENT" ? "sent" : d.status === "FAILED" ? "failed" : "pending", summary: d.eventType, error: redactLogText(d.error), at: d.createdAt.toISOString() });
    }
  }

  return rows.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}
