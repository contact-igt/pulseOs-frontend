"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@pulseos/api-client";
import { Badge, EmptyState, ErrorState, PageHeader, SectionHeading, Skeleton } from "@pulseos/ui";
import { hasPermission } from "@pulseos/types";
import type { ConnectorMode, ConnectorStatus, ConnectorType } from "@pulseos/types";
import { Mail, MessageCircle, Phone, Radio, ShieldCheck, Target, Zap } from "lucide-react";

const TYPE_ICON: Record<ConnectorType, typeof Phone> = {
  MESSAGING: MessageCircle,
  TELEPHONY: Phone,
  ADS: Zap,
  EMAIL: Mail,
  STORAGE: Radio,
  HIS: ShieldCheck,
  ACQUISITION: Target,
};

const TYPE_LABEL: Record<ConnectorType, string> = {
  MESSAGING: "Messaging",
  TELEPHONY: "Telephony",
  ADS: "Ads",
  EMAIL: "Email",
  STORAGE: "Storage",
  HIS: "HIS",
  ACQUISITION: "Acquisition",
};

const STATUS_LABEL: Record<ConnectorStatus, string> = {
  NOT_CONFIGURED: "Not configured",
  CONNECTING: "Connecting",
  CONNECTED: "Connected",
  DEGRADED: "Degraded",
  ERROR: "Error",
  DISABLED: "Disabled",
};

const STATUS_TONE: Record<ConnectorStatus, "neutral" | "warning" | "danger" | "primary"> = {
  NOT_CONFIGURED: "neutral",
  CONNECTING: "warning",
  CONNECTED: "primary",
  DEGRADED: "warning",
  ERROR: "danger",
  DISABLED: "neutral",
};

// A connected connector is only ever really "live" when its mode says so —
// FIXTURE/SANDBOX must never read as equivalent to a real production
// connection, no matter how healthy their status looks otherwise.
const MODE_LABEL: Record<ConnectorMode, string> = { FIXTURE: "Fixture", SANDBOX: "Sandbox", LIVE: "Live" };
const MODE_TONE: Record<ConnectorMode, "neutral" | "warning" | "primary"> = { FIXTURE: "neutral", SANDBOX: "warning", LIVE: "primary" };

function relativeTime(iso: string | null) {
  if (!iso) return "—";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export default function IntegrationsPage() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<"campaigns" | "performance" | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const session = useQuery({ queryKey: ["session"], queryFn: api.session });
  // MANAGE_INTEGRATIONS gates sync/config mutations server-side — mirrored
  // here only to avoid showing dead controls, never as the actual
  // authorization boundary.
  const canManage = !!session.data && hasPermission(session.data.user.role, "MANAGE_INTEGRATIONS");

  const connectors = useQuery({ queryKey: ["connectors"], queryFn: api.connectors });
  const effectiveSelectedId = selectedId ?? connectors.data?.[0]?.id ?? null;

  const detail = useQuery({
    queryKey: ["connector", effectiveSelectedId],
    queryFn: () => api.connector(effectiveSelectedId!),
    enabled: !!effectiveSelectedId,
  });

  async function runSync(kind: "campaigns" | "performance") {
    if (!effectiveSelectedId) return;
    setSyncing(kind);
    setSyncMessage(null);
    const result = kind === "campaigns" ? await api.syncConnectorCampaigns(effectiveSelectedId) : await api.syncConnectorPerformance(effectiveSelectedId);
    setSyncing(null);
    setSyncMessage(result.ok ? `Synced ${result.syncedCount} record${result.syncedCount === 1 ? "" : "s"}.` : (result.message ?? result.reason));
    queryClient.invalidateQueries({ queryKey: ["connector", effectiveSelectedId] });
    queryClient.invalidateQueries({ queryKey: ["connectors"] });
  }

  return (
    <div className="flex h-full flex-col gap-4" data-testid="integrations-page">
      <PageHeader title="Integrations" subtitle="Connected providers and their health." />
      <div className="flex min-h-0 flex-1 gap-4">
      <div className="flex w-96 flex-shrink-0 flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <div className="border-b border-neutral-100 p-3">
          <SectionHeading title="Connectors" subtitle={connectors.data ? `${connectors.data.length}` : undefined} />
        </div>
        <div className="flex-1 overflow-y-auto">
          {connectors.isLoading && <div className="space-y-2 p-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>}
          {connectors.isError && <div className="p-3"><ErrorState message="Could not load connectors." /></div>}
          {connectors.data?.map((c) => {
            const Icon = TYPE_ICON[c.type];
            const active = c.id === effectiveSelectedId;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setSelectedId(c.id);
                  setSyncMessage(null);
                }}
                data-testid={`connector-row-${c.provider}`}
                className={`flex w-full items-start gap-2 border-b border-neutral-100 px-3 py-2.5 text-left hover:bg-neutral-50 ${active ? "bg-primary-50" : ""}`}
              >
                <Icon size={15} className="mt-0.5 flex-shrink-0 text-neutral-400" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-medium text-slate-900">{c.displayName}</span>
                    <span className="whitespace-nowrap text-[10px] text-neutral-400">{relativeTime(c.lastEventAt)}</span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-neutral-500">{TYPE_LABEL[c.type]}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    <Badge tone={STATUS_TONE[c.status]}>{STATUS_LABEL[c.status]}</Badge>
                    <Badge tone={MODE_TONE[c.mode]}>{MODE_LABEL[c.mode]}</Badge>
                    {c.capabilities.slice(0, 2).map((cap) => (
                      <span key={cap} className="rounded bg-neutral-100 px-1.5 py-0.5 text-[9px] font-medium text-neutral-500">
                        {cap.replace(/_/g, " ")}
                      </span>
                    ))}
                    {c.capabilities.length > 2 && <span className="text-[9px] text-neutral-400">+{c.capabilities.length - 2}</span>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto rounded-lg border border-neutral-200 bg-white p-5">
        {!detail.data && !detail.isLoading && <EmptyState message="Select a connector to view its configuration." />}
        {detail.isLoading && <Skeleton className="h-64" />}
        {detail.data && (
          <div className="space-y-5">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900">{detail.data.connector.displayName}</h2>
                <p className="mt-0.5 text-xs text-neutral-500">
                  {TYPE_LABEL[detail.data.connector.type]} · provider key <code className="rounded bg-neutral-100 px-1 py-0.5 text-[11px]">{detail.data.connector.provider}</code>
                </p>
              </div>
              <span className="flex items-center gap-1.5">
                <Badge tone={STATUS_TONE[detail.data.connector.status]}>{STATUS_LABEL[detail.data.connector.status]}</Badge>
                <Badge tone={MODE_TONE[detail.data.connector.mode]}>{MODE_LABEL[detail.data.connector.mode]}</Badge>
              </span>
            </div>

            <div className="grid grid-cols-3 gap-4 border-y border-neutral-100 py-4 text-xs">
              <div>
                <span className="block text-[11px] uppercase tracking-wide text-neutral-400">Secrets configured</span>
                <span className="text-sm text-slate-800">{detail.data.connector.hasSecrets ? "Yes" : "No"}</span>
              </div>
              <div>
                <span className="block text-[11px] uppercase tracking-wide text-neutral-400">Last event</span>
                <span className="text-sm text-slate-800">{relativeTime(detail.data.connector.lastEventAt)}</span>
              </div>
              <div>
                <span className="block text-[11px] uppercase tracking-wide text-neutral-400">Last sync</span>
                <span className="text-sm text-slate-800">{relativeTime(detail.data.connector.lastSyncAt)}</span>
              </div>
            </div>

            {detail.data.connector.lastError && (
              <div className="rounded border border-danger-100 bg-danger-100/40 px-3 py-2 text-xs text-danger-700">
                Last error: {detail.data.connector.lastError}
              </div>
            )}

            <div>
              <SectionHeading title="Capabilities" />
              <div className="flex flex-wrap gap-1.5">
                {detail.data.connector.capabilities.map((cap) => (
                  <span key={cap} className="rounded bg-neutral-100 px-2 py-1 text-[11px] font-medium text-neutral-600">
                    {cap.replace(/_/g, " ")}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <SectionHeading title="Configuration" subtitle="Non-secret metadata only" />
              {!detail.data.configuration && <p className="text-xs text-neutral-400">No configuration set.</p>}
              {detail.data.configuration && (
                <dl className="space-y-1 text-xs">
                  {Object.entries(detail.data.configuration).map(([key, value]) => (
                    <div key={key} className="flex justify-between border-b border-neutral-50 pb-1">
                      <dt className="text-neutral-500">{key}</dt>
                      <dd className="font-medium text-slate-800">{String(value)}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>

            <div>
              <SectionHeading title="Recent events" subtitle={`${detail.data.recentEvents.length}`} />
              {detail.data.recentEvents.length === 0 && <p className="text-xs text-neutral-400">No events recorded yet.</p>}
              {detail.data.recentEvents.length > 0 && (
                <div className="overflow-hidden rounded border border-neutral-100">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-neutral-50 text-neutral-500">
                      <tr>
                        <th className="px-2 py-1.5 font-medium">Direction</th>
                        <th className="px-2 py-1.5 font-medium">Status</th>
                        <th className="px-2 py-1.5 font-medium">Event id</th>
                        <th className="px-2 py-1.5 font-medium">Received</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {detail.data.recentEvents.map((e) => (
                        <tr key={e.id}>
                          <td className="px-2 py-1.5 text-neutral-600">{e.direction}</td>
                          <td className="px-2 py-1.5">
                            <Badge tone={e.status === "failed" ? "danger" : e.status === "duplicate" ? "warning" : "neutral"}>{e.status}</Badge>
                          </td>
                          <td className="px-2 py-1.5 text-neutral-500">{e.externalEventId}</td>
                          <td className="px-2 py-1.5 text-neutral-500">{relativeTime(e.receivedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => queryClient.invalidateQueries({ queryKey: ["connector", effectiveSelectedId] })}
                className="rounded border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
              >
                Refresh
              </button>
              {canManage && detail.data.connector.capabilities.includes("SYNC_CAMPAIGNS") && (
                <button
                  type="button"
                  onClick={() => runSync("campaigns")}
                  disabled={syncing !== null}
                  className="rounded bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                  data-testid="sync-campaigns-button"
                >
                  {syncing === "campaigns" ? "Syncing…" : "Sync Campaigns"}
                </button>
              )}
              {canManage && detail.data.connector.capabilities.includes("SYNC_PERFORMANCE") && (
                <button
                  type="button"
                  onClick={() => runSync("performance")}
                  disabled={syncing !== null}
                  className="rounded bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                  data-testid="sync-performance-button"
                >
                  {syncing === "performance" ? "Syncing…" : "Sync Performance"}
                </button>
              )}
              {syncMessage && <span className="text-xs text-neutral-500">{syncMessage}</span>}
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
