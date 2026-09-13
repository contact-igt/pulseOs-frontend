import type { MessagingProviderAdapter, TelephonyProviderAdapter } from "./types.js";
import { whatsAppMetaCloudAdapter } from "./adapters/whatsapp-meta-cloud.js";
import { runoTelephonyAdapter } from "./adapters/runo.js";

// The ONLY place a provider name is ever matched against a string. Domain
// services (Conversation, Task, Timeline) never branch on "whatsapp" or
// "runo" — they call through MessagingProviderAdapter/TelephonyProviderAdapter.
export const MESSAGING_ADAPTERS: Record<string, MessagingProviderAdapter> = {
  whatsapp_meta_cloud: whatsAppMetaCloudAdapter,
};

export const TELEPHONY_ADAPTERS: Record<string, TelephonyProviderAdapter> = {
  runo: runoTelephonyAdapter,
};

export function getMessagingAdapter(provider: string): MessagingProviderAdapter | null {
  return MESSAGING_ADAPTERS[provider] ?? null;
}

export function getTelephonyAdapter(provider: string): TelephonyProviderAdapter | null {
  return TELEPHONY_ADAPTERS[provider] ?? null;
}
