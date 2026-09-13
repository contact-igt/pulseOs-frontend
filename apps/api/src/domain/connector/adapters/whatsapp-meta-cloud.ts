import { createHmac, timingSafeEqual } from "node:crypto";
import type { MessagingProviderAdapter, ParsedWhatsAppWebhook } from "../types.js";

// Ported patterns from invictus-chatbot's AuthWhatsApp controller/service (read
// fully, reference-only): the GET challenge check (hub.mode/hub.verify_token/
// hub.challenge), the atomic-dedupe-on-wamid idea (we use the shared
// connector_events unique index instead of a bespoke table), and the Graph
// API outbound call shape (POST .../{phone_number_id}/messages, Bearer
// token, response.messages[0].id is the wamid). HMAC signature verification
// was NOT present in that reference implementation — added here per Meta's
// own documented webhook security contract, since PulseOS must not accept
// unsigned webhook traffic.
const META_API_VERSION = "v23.0";

function verifySignature(rawBody: string, signatureHeader: string | undefined, appSecret: string): boolean {
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const expectedHex = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  const providedHex = signatureHeader.slice("sha256=".length);
  const expected = Buffer.from(expectedHex, "hex");
  const provided = Buffer.from(providedHex, "hex");
  if (expected.length !== provided.length) return false;
  return timingSafeEqual(expected, provided);
}

interface MetaWebhookValue {
  metadata?: { phone_number_id?: string };
  contacts?: { wa_id: string; profile?: { name?: string } }[];
  messages?: { id: string; from: string; timestamp: string; type: string; text?: { body?: string } }[];
  statuses?: { id: string; status: string; timestamp: string }[];
}

export const whatsAppMetaCloudAdapter: MessagingProviderAdapter = {
  capabilities: ["SEND_MESSAGE", "RECEIVE_MESSAGE", "RECEIVE_STATUS"],

  verifyWebhookChallenge(query, secrets) {
    const mode = query["hub.mode"];
    const token = query["hub.verify_token"];
    const challenge = query["hub.challenge"];
    if (mode !== "subscribe" || !token || !challenge) return null;
    if (token !== secrets.webhookVerifyToken) return null;
    return challenge;
  },

  verifyWebhookSignature(rawBody, signatureHeader, secrets) {
    const appSecret = secrets.appSecret;
    if (typeof appSecret !== "string" || !appSecret) return false;
    return verifySignature(rawBody, signatureHeader, appSecret);
  },

  parseWebhookPayload(payload): ParsedWhatsAppWebhook {
    const result: ParsedWhatsAppWebhook = { messages: [], statuses: [] };
    const body = payload as { entry?: { changes?: { value?: MetaWebhookValue }[] }[] };
    const entries = body.entry ?? [];

    for (const entry of entries) {
      for (const change of entry.changes ?? []) {
        const value = change.value;
        if (!value) continue;

        const contactByWaId = new Map((value.contacts ?? []).map((c) => [c.wa_id, c.profile?.name ?? null]));

        for (const msg of value.messages ?? []) {
          const bodyText = msg.type === "text" ? (msg.text?.body ?? "") : `[unsupported message type: ${msg.type}]`;
          result.messages.push({
            externalEventId: msg.id,
            externalThreadId: msg.from,
            fromPhone: msg.from,
            fromName: contactByWaId.get(msg.from) ?? null,
            body: bodyText,
            occurredAt: new Date(Number(msg.timestamp) * 1000),
          });
        }

        for (const status of value.statuses ?? []) {
          if (status.status !== "sent" && status.status !== "delivered" && status.status !== "read" && status.status !== "failed") continue;
          result.statuses.push({
            externalEventId: `${status.id}:${status.status}`,
            providerMessageId: status.id,
            status: status.status,
            occurredAt: new Date(Number(status.timestamp) * 1000),
          });
        }
      }
    }

    return result;
  },

  async sendMessage(config, secrets, to, body) {
    if (config.mode === "fixture") {
      // No live Meta credentials in local dev — this is a genuinely usable,
      // deterministic stand-in for the Graph API response shape, never
      // presented as a real delivered message.
      return { providerMessageId: `FIXTURE_WAMID_${Date.now()}_${Math.random().toString(36).slice(2, 8)}` };
    }

    const phoneNumberId = config.phoneNumberId;
    const accessToken = secrets.accessToken;
    if (typeof phoneNumberId !== "string" || typeof accessToken !== "string") {
      throw new Error("WhatsApp connector is missing phoneNumberId configuration or accessToken secret");
    }

    const res = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body } }),
    });

    if (!res.ok) {
      const errorBody = await res.text().catch(() => "");
      throw new Error(`WhatsApp send failed: ${res.status} ${errorBody}`);
    }

    const data = (await res.json()) as { messages?: { id?: string }[] };
    const providerMessageId = data.messages?.[0]?.id;
    if (!providerMessageId) throw new Error("WhatsApp send succeeded but returned no message id");
    return { providerMessageId };
  },
};
