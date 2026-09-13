"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@pulseos/api-client";
import { Badge, Card, ErrorState, SectionHeading, Skeleton } from "@pulseos/ui";
import type { CustomFieldType } from "@pulseos/types";

const FIELD_TYPES: CustomFieldType[] = ["TEXT", "NUMBER", "DATE", "BOOLEAN", "SELECT", "MULTI_SELECT", "PHONE"];

function SpecialtyDetail({ specialtyKey }: { specialtyKey: string }) {
  const queryClient = useQueryClient();
  const detail = useQuery({ queryKey: ["specialty-detail", specialtyKey], queryFn: () => api.specialtyDetail(specialtyKey) });
  const [newLabel, setNewLabel] = useState("");
  const [newType, setNewType] = useState<CustomFieldType>("TEXT");

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["specialty-detail", specialtyKey] });
    queryClient.invalidateQueries({ queryKey: ["specialties"] });
  }

  async function addField() {
    if (!newLabel.trim()) return;
    const key = newLabel.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    await api.createCustomField(specialtyKey, { key, label: newLabel.trim(), fieldType: newType });
    setNewLabel("");
    invalidate();
  }

  async function archiveField(fieldId: string) {
    await api.updateCustomField(fieldId, { archived: true });
    invalidate();
  }

  if (detail.isLoading) return <Skeleton className="h-32" />;
  if (detail.isError || !detail.data) return <ErrorState message="Could not load this specialty." />;

  return (
    <div className="space-y-3 border-t border-neutral-100 p-4">
      {detail.data.fields.length === 0 ? (
        <p className="text-xs text-neutral-400">No custom fields configured yet.</p>
      ) : (
        <ul className="divide-y divide-neutral-100 rounded border border-neutral-100">
          {detail.data.fields.map((f) => (
            <li key={f.id} className="flex items-center justify-between px-3 py-2 text-xs">
              <span className="text-slate-800">
                {f.label} <span className="text-neutral-400">({f.fieldType.toLowerCase()}{f.required ? ", required" : ""})</span>
              </span>
              <button type="button" onClick={() => archiveField(f.id)} className="text-neutral-400 hover:text-danger-600">
                Archive
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          placeholder="New field label…"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          className="rounded border border-neutral-200 px-2 py-1 text-xs outline-none focus:border-primary-400"
        />
        <select value={newType} onChange={(e) => setNewType(e.target.value as CustomFieldType)} className="rounded border border-neutral-200 px-2 py-1 text-xs">
          {FIELD_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <button type="button" onClick={addField} disabled={!newLabel.trim()} className="rounded bg-primary-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-primary-700 disabled:opacity-40">
          Add field
        </button>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const specialties = useQuery({ queryKey: ["specialties-admin"], queryFn: () => api.specialties(true) });
  const [expanded, setExpanded] = useState<string | null>(null);

  async function toggleEnabled(key: string, enabled: boolean) {
    await api.updateSpecialty(key, { enabled: !enabled });
    queryClient.invalidateQueries({ queryKey: ["specialties-admin"] });
    queryClient.invalidateQueries({ queryKey: ["specialties"] });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5" data-testid="settings-page">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Settings</h1>
        <p className="text-sm text-neutral-500">Specialties, custom fields and hospital configuration.</p>
      </div>

      <Card className="p-4">
        <SectionHeading title="Specialties & Fields" subtitle="Configure which specialties Add Lead offers, and their custom fields" />

        {specialties.isLoading && <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>}
        {specialties.isError && <ErrorState message="Could not load specialties." />}
        {specialties.data && (
          <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200" data-testid="specialty-list">
            {specialties.data.map((s) => (
              <li key={s.key}>
                <div className="flex items-center justify-between px-4 py-3">
                  <button type="button" onClick={() => setExpanded(expanded === s.key ? null : s.key)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                    <span className="text-sm font-medium text-slate-900">{s.displayName}</span>
                    <Badge tone={s.enabled ? "primary" : "neutral"}>{s.enabled ? "Enabled" : "Disabled"}</Badge>
                    <span className="text-xs text-neutral-400">{s.fieldCount} custom field{s.fieldCount === 1 ? "" : "s"}</span>
                  </button>
                  <div className="flex shrink-0 items-center gap-3">
                    <button type="button" onClick={() => toggleEnabled(s.key, s.enabled)} className="text-xs font-medium text-primary-600 hover:underline" data-testid={`specialty-toggle-${s.key}`}>
                      {s.enabled ? "Disable" : "Enable"}
                    </button>
                    <button type="button" onClick={() => setExpanded(expanded === s.key ? null : s.key)} className="text-xs text-neutral-500 hover:text-slate-900">
                      {expanded === s.key ? "Close" : "Edit"}
                    </button>
                  </div>
                </div>
                {expanded === s.key && <SpecialtyDetail specialtyKey={s.key} />}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
