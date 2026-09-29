"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp } from "lucide-react";
import { api } from "@pulseos/api-client";
import { Badge, Button, ConfirmDialog, ErrorState, Panel, Skeleton } from "@pulseos/ui";
import { hasPermission } from "@pulseos/types";
import type { CustomFieldDefinitionVm, CustomFieldType, SpecialtyDetailVm, UpdateCustomFieldInput } from "@pulseos/types";

const FIELD_TYPES: CustomFieldType[] = ["TEXT", "NUMBER", "DATE", "BOOLEAN", "SELECT", "MULTI_SELECT", "PHONE"];
const SELECT_TYPES = new Set<CustomFieldType>(["SELECT", "MULTI_SELECT"]);

function FieldRow({
  field,
  isFirst,
  isLast,
  onMove,
  onSave,
  onArchive,
}: {
  field: CustomFieldDefinitionVm;
  isFirst: boolean;
  isLast: boolean;
  onMove: (direction: "up" | "down") => void;
  onSave: (input: UpdateCustomFieldInput) => void;
  onArchive: () => void;
}) {
  const isSelectType = SELECT_TYPES.has(field.fieldType);

  return (
    <li className="flex flex-col gap-1.5 px-3 py-2 text-xs" data-testid={`field-row-${field.key}`}>
      <div className="flex items-center gap-2">
        <div className="flex shrink-0 flex-col">
          <button type="button" onClick={() => onMove("up")} disabled={isFirst} className="text-ink-2 hover:text-ink disabled:opacity-30" aria-label={`Move ${field.label} up`} data-testid={`field-move-up-${field.key}`}>
            <ChevronUp size={12} />
          </button>
          <button type="button" onClick={() => onMove("down")} disabled={isLast} className="text-ink-2 hover:text-ink disabled:opacity-30" aria-label={`Move ${field.label} down`} data-testid={`field-move-down-${field.key}`}>
            <ChevronDown size={12} />
          </button>
        </div>
        <input
          type="text"
          defaultValue={field.label}
          onBlur={(e) => {
            const next = e.target.value.trim();
            if (next && next !== field.label) onSave({ label: next });
          }}
          className="min-w-0 flex-1 rounded border border-transparent px-1 py-0.5 text-ink outline-none hover:border-neutral-200 focus:border-primary-400"
        />
        <span className="shrink-0 text-ink-2">{field.fieldType.toLowerCase()}</span>
        <label className="flex shrink-0 items-center gap-1 text-ink-2">
          <input type="checkbox" checked={field.required} onChange={(e) => onSave({ required: e.target.checked })} />
          Required
        </label>
        <button type="button" onClick={onArchive} className="shrink-0 text-ink-2 hover:text-danger-700">
          Archive
        </button>
      </div>
      {isSelectType && (
        <div className="ml-5 flex items-center gap-1.5">
          <span className="shrink-0 text-ink-2">Options</span>
          <input
            type="text"
            defaultValue={(field.options ?? []).join(", ")}
            placeholder="Comma-separated options…"
            onBlur={(e) => {
              const next = e.target.value.split(",").map((s) => s.trim()).filter(Boolean);
              onSave({ options: next });
            }}
            className="min-w-0 flex-1 h-7 rounded-control border border-line-strong bg-surface px-1.5 text-ink outline-none focus:border-primary-500"
          />
        </div>
      )}
    </li>
  );
}

function SpecialtyDetail({ specialtyKey }: { specialtyKey: string }) {
  const queryClient = useQueryClient();
  const detail = useQuery({ queryKey: ["specialty-detail", specialtyKey], queryFn: () => api.specialtyDetail(specialtyKey) });
  const [newLabel, setNewLabel] = useState("");
  const [newType, setNewType] = useState<CustomFieldType>("TEXT");
  const [newOptions, setNewOptions] = useState("");
  const [confirmingArchive, setConfirmingArchive] = useState<CustomFieldDefinitionVm | null>(null);
  // A save failure here must never look like it silently succeeded — every
  // input already preserves what was typed (defaultValue/value are untouched
  // on error), so the only missing piece is surfacing that it didn't persist.
  const [saveError, setSaveError] = useState<string | null>(null);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["specialty-detail", specialtyKey] });
    queryClient.invalidateQueries({ queryKey: ["specialties-admin"] });
    queryClient.invalidateQueries({ queryKey: ["specialties"] });
  }

  async function addField() {
    if (!newLabel.trim()) return;
    const key = newLabel.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    const options = SELECT_TYPES.has(newType) ? newOptions.split(",").map((s) => s.trim()).filter(Boolean) : undefined;
    try {
      setSaveError(null);
      await api.createCustomField(specialtyKey, { key, label: newLabel.trim(), fieldType: newType, options });
      setNewLabel("");
      setNewOptions("");
      invalidate();
    } catch {
      setSaveError("Could not add this field — your entry is still here, try again.");
    }
  }

  async function archiveField(fieldId: string) {
    try {
      setSaveError(null);
      await api.updateCustomField(fieldId, { archived: true });
      invalidate();
    } catch {
      setSaveError("Could not archive this field — try again.");
    }
  }

  async function saveField(fieldId: string, input: UpdateCustomFieldInput) {
    try {
      setSaveError(null);
      await api.updateCustomField(fieldId, input);
      invalidate();
    } catch {
      setSaveError("Could not save that change — try again.");
    }
  }

  async function moveField(fields: CustomFieldDefinitionVm[], index: number, direction: "up" | "down") {
    const swapWith = direction === "up" ? index - 1 : index + 1;
    if (swapWith < 0 || swapWith >= fields.length) return;
    const a = fields[index];
    const b = fields[swapWith];
    try {
      setSaveError(null);
      await Promise.all([api.updateCustomField(a.id, { sortOrder: b.sortOrder }), api.updateCustomField(b.id, { sortOrder: a.sortOrder })]);
      invalidate();
    } catch {
      setSaveError("Could not reorder that field — try again.");
    }
  }

  async function saveHeader(input: { displayName?: string; defaultJourneyType?: string }) {
    try {
      setSaveError(null);
      await api.updateSpecialty(specialtyKey, input);
      invalidate();
    } catch {
      setSaveError("Could not save that change — your entry is still here, try again.");
    }
  }

  if (detail.isLoading) return <Skeleton className="h-32" />;
  if (detail.isError || !detail.data) return <ErrorState message="Could not load this specialty." />;

  const d: SpecialtyDetailVm = detail.data;

  return (
    <div className="space-y-3 border-t border-line p-4">
      {saveError && (
        <p className="rounded-control border border-danger-100 bg-danger-100/60 px-2.5 py-1.5 text-xs text-danger-700" data-testid="specialty-save-error">
          {saveError}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-4 text-xs">
        <label className="flex items-center gap-1.5">
          <span className="text-ink-2">Display label</span>
          <input
            type="text"
            defaultValue={d.displayName}
            onBlur={(e) => {
              const next = e.target.value.trim();
              if (next && next !== d.displayName) saveHeader({ displayName: next });
            }}
            className="h-8 rounded-control border border-line-strong bg-surface px-2 text-ink outline-none focus:border-primary-500"
            data-testid="specialty-display-label"
          />
        </label>
        <label className="flex items-center gap-1.5">
          <span className="text-ink-2">Default Journey type</span>
          <input
            type="text"
            defaultValue={d.defaultJourneyType}
            onBlur={(e) => {
              const next = e.target.value.trim();
              if (next && next !== d.defaultJourneyType) saveHeader({ defaultJourneyType: next });
            }}
            className="h-8 rounded-control border border-line-strong bg-surface px-2 text-ink outline-none focus:border-primary-500"
            data-testid="specialty-default-journey-type"
          />
        </label>
      </div>

      {d.fields.length === 0 ? (
        <p className="text-xs text-ink-2">No custom fields configured yet.</p>
      ) : (
        <ul className="divide-y divide-line rounded-control border border-line">
          {d.fields.map((f, i) => (
            <FieldRow
              key={f.id}
              field={f}
              isFirst={i === 0}
              isLast={i === d.fields.length - 1}
              onMove={(direction) => moveField(d.fields, i, direction)}
              onSave={(input) => saveField(f.id, input)}
              onArchive={() => setConfirmingArchive(f)}
            />
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          placeholder="New field label…"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          className="h-8 rounded-control border border-line-strong bg-surface px-2 text-xs text-ink outline-none placeholder:text-neutral-500 focus:border-primary-500"
        />
        <select value={newType} onChange={(e) => setNewType(e.target.value as CustomFieldType)} className="h-8 rounded-control border border-line-strong bg-surface px-2 text-xs text-ink">
          {FIELD_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        {SELECT_TYPES.has(newType) && (
          <input
            type="text"
            placeholder="Options, comma-separated…"
            value={newOptions}
            onChange={(e) => setNewOptions(e.target.value)}
            className="h-8 rounded-control border border-line-strong bg-surface px-2 text-xs text-ink outline-none placeholder:text-neutral-500 focus:border-primary-500"
          />
        )}
        <Button size="sm" variant="primary" onClick={addField} disabled={!newLabel.trim()}>
          Add field
        </Button>
      </div>

      <ConfirmDialog
        open={!!confirmingArchive}
        title={confirmingArchive ? `Archive "${confirmingArchive.label}"?` : ""}
        description="This removes it from the Add Lead form and this editor going forward. Existing patients who already have a value saved for it keep that value on their record — archiving doesn't delete historical data, only stops collecting it for new journeys."
        confirmLabel="Archive field"
        onConfirm={() => {
          if (confirmingArchive) archiveField(confirmingArchive.id);
          setConfirmingArchive(null);
        }}
        onCancel={() => setConfirmingArchive(null)}
      />
    </div>
  );
}

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const session = useQuery({ queryKey: ["session"], queryFn: api.session });
  // MANAGE_SPECIALTIES gates every write server-side (Hospital/Super Admin
  // only) — mirrored here to keep the read-only roles from seeing Edit/
  // Disable controls that would 403, never as the actual authorization
  // boundary. Everyone with VIEW access still sees the plain list.
  const canManage = !!session.data && hasPermission(session.data.user.role, "MANAGE_SPECIALTIES");
  const specialties = useQuery({ queryKey: ["specialties-admin"], queryFn: () => api.specialties(true) });
  const [expanded, setExpanded] = useState<string | null>(null);

  async function toggleEnabled(key: string, enabled: boolean) {
    await api.updateSpecialty(key, { enabled: !enabled });
    queryClient.invalidateQueries({ queryKey: ["specialties-admin"] });
    queryClient.invalidateQueries({ queryKey: ["specialties"] });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5" data-testid="settings-page">
      <Panel title="Specialties & Fields" subtitle="Configure which specialties Add Lead offers, and their custom fields">
        {(specialties.isLoading || session.isLoading) && <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>}
        {specialties.isError && <ErrorState message="Could not load specialties." />}
        {specialties.data && !session.isLoading && (
          <ul className="divide-y divide-line rounded-control border border-line" data-testid="specialty-list">
            {specialties.data.map((s) => (
              <li key={s.key}>
                <div className="flex items-center justify-between px-4 py-3">
                  {canManage ? (
                    <button type="button" onClick={() => setExpanded(expanded === s.key ? null : s.key)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                      <span className="text-sm font-medium text-ink">{s.displayName}</span>
                      <Badge tone={s.enabled ? "success" : "neutral"}>{s.enabled ? "Enabled" : "Disabled"}</Badge>
                      <span className="min-w-0 truncate text-xs text-ink-2">{s.fieldCount} custom field{s.fieldCount === 1 ? "" : "s"}</span>
                    </button>
                  ) : (
                    <div className="flex min-w-0 flex-1 items-center gap-3 text-left">
                      <span className="text-sm font-medium text-ink">{s.displayName}</span>
                      <Badge tone={s.enabled ? "success" : "neutral"}>{s.enabled ? "Enabled" : "Disabled"}</Badge>
                      <span className="min-w-0 truncate text-xs text-ink-2">{s.fieldCount} custom field{s.fieldCount === 1 ? "" : "s"}</span>
                    </div>
                  )}
                  {canManage && (
                    <div className="flex shrink-0 items-center gap-3">
                      <button type="button" onClick={() => toggleEnabled(s.key, s.enabled)} className="text-xs font-medium text-primary-700 hover:underline" data-testid={`specialty-toggle-${s.key}`}>
                        {s.enabled ? "Disable" : "Enable"}
                      </button>
                      <button type="button" onClick={() => setExpanded(expanded === s.key ? null : s.key)} className="text-xs text-ink-2 hover:text-ink">
                        {expanded === s.key ? "Close" : "Edit"}
                      </button>
                    </div>
                  )}
                </div>
                {canManage && expanded === s.key && <SpecialtyDetail specialtyKey={s.key} />}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
