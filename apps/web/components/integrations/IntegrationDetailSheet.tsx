"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@pulseos/api-client";
import { Badge, Button, ErrorState, SideSheet, Skeleton, Tabs, relativeTime } from "@pulseos/ui";
import type { IntegrationDetail } from "@pulseos/types";
import { CONFIG_LABEL, CONFIG_TONE, HEALTH_LABEL, HEALTH_TONE, MODE_LABEL, MODE_TONE } from "./hubLabels";
import { LogsPanel } from "./LogsPanel";

const field = "h-11 w-full rounded-control border border-line-strong bg-surface px-2 text-sm text-ink outline-none focus:border-primary-500 sm:h-9";

type SectionKey = "overview" | "configuration" | "credentials" | "mappings" | "webhooks" | "activity" | "health";

function Overview({ d }: { d: IntegrationDetail }) {
  return (
    <div className="space-y-3 text-sm">
      <p className="text-ink-2">{d.purpose}</p>
      {d.blockedReason && <p className="rounded-control border border-danger-100 bg-danger-100/50 px-3 py-2 text-xs text-danger-700">{d.blockedReason}. Nothing can be enabled or configured until it is provided.</p>}
      <dl className="grid grid-cols-2 gap-3 text-xs">
        <div><dt className="text-ink-3">Enabled</dt><dd className="mt-0.5">{d.capability ? <Badge tone={d.enabled ? "primary" : "neutral"}>{d.enabled ? "On" : "Off"}</Badge> : "Always available"}</dd></div>
        <div><dt className="text-ink-3">Configuration</dt><dd className="mt-0.5"><Badge tone={CONFIG_TONE[d.configuration]}>{CONFIG_LABEL[d.configuration]}</Badge></dd></div>
        <div><dt className="text-ink-3">Health</dt><dd className="mt-0.5"><Badge tone={HEALTH_TONE[d.health]}>{HEALTH_LABEL[d.health]}</Badge></dd></div>
        <div><dt className="text-ink-3">Mode</dt><dd className="mt-0.5"><Badge tone={MODE_TONE[d.mode]}>{MODE_LABEL[d.mode]}</Badge></dd></div>
      </dl>
      {d.capability && (
        <p className="text-xs text-ink-2">
          The on/off switch lives in <Link href="/settings?section=features" className="text-primary-700 underline-offset-2 hover:underline">Settings → Features</Link>. Turning it on does not configure or connect anything.
        </p>
      )}
    </div>
  );
}

function ConfigurationForm({ d, secrets }: { d: IntegrationDetail; secrets: boolean }) {
  const queryClient = useQueryClient();
  const fields = secrets ? d.secretFields : d.configurationFields;
  const [values, setValues] = useState<Record<string, string>>(() => (secrets ? {} : { ...d.configurationValues }));
  const [mode, setMode] = useState(d.connectorMode ?? "FIXTURE");
  const [message, setMessage] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: () => api.configureIntegration(d.key, secrets ? { secrets: values, ...(mode !== (d.connectorMode ?? "FIXTURE") ? { mode } : {}) } : { configuration: values }),
    onSuccess: () => {
      setMessage("Saved.");
      if (secrets) setValues({});
      queryClient.invalidateQueries({ queryKey: ["integration-detail", d.key] });
      queryClient.invalidateQueries({ queryKey: ["integration-hub"] });
    },
    onError: () => setMessage("Could not save — check the values and your permission."),
  });
  const allowed = secrets ? d.canManageSecrets : d.canConfigure;
  if (fields.length === 0) return <p className="text-sm text-ink-2">{secrets ? "No credentials are needed." : "Nothing to configure."}</p>;
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        setMessage(null);
        save.mutate();
      }}
    >
      {!allowed && <p className="text-xs text-ink-2">{secrets ? "Only a Super Admin can change credentials." : "You can view this, but not change it."}</p>}
      {fields.map((f) => {
        const hasSecret = "hasSecret" in f ? f.hasSecret : false;
        return (
          <label key={f.key} className="block text-xs text-ink-2">
            <span className="flex items-center justify-between gap-2">
              {f.label}
              {secrets && <Badge tone={hasSecret ? "success" : "neutral"}>{hasSecret ? "Secret saved" : "Not set"}</Badge>}
            </span>
            <input
              type={secrets ? "password" : "text"}
              autoComplete="off"
              value={values[f.key] ?? ""}
              disabled={!allowed}
              placeholder={secrets && hasSecret ? "Leave blank to keep the saved secret" : undefined}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              className={`mt-1 ${field}`}
              data-testid={`${secrets ? "secret" : "config"}-${f.key}`}
            />
            {f.help && <span className="mt-0.5 block text-[11px] text-ink-3">{f.help}</span>}
          </label>
        );
      })}
      {secrets && allowed && (
        <label className="block text-xs text-ink-2">
          Connection mode
          <select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)} className={`mt-1 ${field}`} data-testid="connection-mode">
            <option value="FIXTURE">Fixture — sample data, no provider contact</option>
            <option value="SANDBOX">Sandbox — the provider&apos;s test environment</option>
            <option value="LIVE">Live — the real provider</option>
          </select>
        </label>
      )}
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" variant="primary" disabled={!allowed || save.isPending} data-testid={`save-${secrets ? "credentials" : "configuration"}`}>
          {save.isPending ? "Saving…" : "Save"}
        </Button>
        {message && <span role="status" className="text-xs text-ink-2">{message}</span>}
      </div>
    </form>
  );
}

function Health({ d }: { d: IntegrationDetail }) {
  return (
    <div className="space-y-2 text-sm">
      <p>
        <Badge tone={HEALTH_TONE[d.health]}>{HEALTH_LABEL[d.health]}</Badge>
      </p>
      <p className="text-xs text-ink-2">Health only reflects what the provider last confirmed. A configured connection stays &ldquo;Not verified&rdquo; until a real event or sync succeeds.</p>
      <dl className="grid grid-cols-2 gap-3 text-xs">
        <div><dt className="text-ink-3">Last event</dt><dd>{relativeTime(d.lastEventAt)}</dd></div>
        <div><dt className="text-ink-3">Last sync</dt><dd>{relativeTime(d.lastSyncAt)}</dd></div>
      </dl>
      {d.lastError && <p className="rounded-control border border-danger-100 bg-danger-100/50 px-3 py-2 text-xs text-danger-700">Last error: {d.lastError}</p>}
    </div>
  );
}

export function IntegrationDetailSheet({ integrationKey, onClose }: { integrationKey: string; onClose: () => void }) {
  const q = useQuery({ queryKey: ["integration-detail", integrationKey], queryFn: () => api.integrationDetail(integrationKey) });
  const [section, setSection] = useState<SectionKey>("overview");
  const d = q.data;
  const sections: { key: SectionKey; label: string }[] = d
    ? [
        { key: "overview", label: "Overview" },
        ...(d.configurationFields.length ? [{ key: "configuration" as const, label: "Configuration" }] : []),
        ...(d.secretFields.length ? [{ key: "credentials" as const, label: "Credentials" }] : []),
        ...(d.mappingNotes ? [{ key: "mappings" as const, label: "Mappings" }] : []),
        ...(d.webhookUrl ? [{ key: "webhooks" as const, label: "Webhooks" }] : []),
        ...(d.key !== "webhooks" && !d.blockedReason ? [{ key: "activity" as const, label: "Activity" }, { key: "health" as const, label: "Health" }] : []),
      ]
    : [];
  return (
    <SideSheet title={d?.name ?? "Integration"} subtitle={d?.provider} onClose={onClose} testId="integration-detail">
      {q.isLoading && <Skeleton className="h-40" />}
      {q.isError && <ErrorState message="Could not load this integration." />}
      {d && (
        <div className="space-y-4">
          <Tabs variant="underline" ariaLabel="Integration sections" value={section} onChange={(k) => setSection(k as SectionKey)} items={sections.map((s) => ({ ...s, testId: `detail-tab-${s.key}` }))} />
          {section === "overview" && <Overview d={d} />}
          {section === "configuration" && <ConfigurationForm d={d} secrets={false} />}
          {section === "credentials" && <ConfigurationForm d={d} secrets />}
          {section === "mappings" && <p className="text-sm text-ink-2">{d.mappingNotes}</p>}
          {section === "webhooks" && (
            <div className="space-y-2 text-sm">
              <p className="text-xs text-ink-2">Give the provider this address to send events to PulseOS:</p>
              <code className="block break-all rounded-control bg-neutral-100 px-2 py-1.5 text-xs" data-testid="provider-webhook-url">{d.webhookUrl}</code>
              <p className="text-[11px] text-ink-3">Every request is verified with the provider&apos;s own signature or shared secret before anything is read.</p>
            </div>
          )}
          {section === "activity" && <LogsPanel provider={d.key} />}
          {section === "health" && <Health d={d} />}
        </div>
      )}
    </SideSheet>
  );
}
