"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@pulseos/api-client";
import { useRouter } from "next/navigation";
import { Badge, ConfirmDialog, EmptyState, ErrorState, OverflowMenu, SectionHeading, Skeleton, useDialogFocus } from "@pulseos/ui";
import { useQuickCreate } from "../../../components/shell/QuickCreateProvider";
import { withFrom } from "@/components/shell/BackLink";
import type { ConversationChannel, ConversationDetail, OwnershipState } from "@pulseos/types";
import { ArrowLeft, CalendarPlus, ListPlus, Mail, MessageCircle, MessageSquareText, PanelRight, Phone, User, Users as UsersIcon, X } from "lucide-react";

const CHANNEL_ICON: Record<ConversationChannel, typeof Mail> = {
  WHATSAPP: MessageCircle,
  CALL: Phone,
  SMS: MessageSquareText,
  EMAIL: Mail,
  INTERNAL: UsersIcon,
};

const CHANNEL_LABEL: Record<ConversationChannel, string> = {
  WHATSAPP: "WhatsApp",
  CALL: "Call",
  SMS: "SMS",
  EMAIL: "Email",
  INTERNAL: "Internal",
};

const OWNERSHIP_LABEL: Record<OwnershipState, string> = {
  AI_ACTIVE: "AI active",
  HUMAN_REQUIRED: "Needs attention",
  HUMAN_ASSIGNED: "Assigned",
  HUMAN_ACTIVE: "You're handling this",
  AI_RESUME_PENDING: "Returning to AI",
  CLOSED: "Closed",
};

const OWNERSHIP_TONE: Record<OwnershipState, "neutral" | "warning" | "danger" | "primary"> = {
  AI_ACTIVE: "neutral",
  HUMAN_REQUIRED: "warning",
  HUMAN_ASSIGNED: "neutral",
  HUMAN_ACTIVE: "primary",
  AI_RESUME_PENDING: "neutral",
  CLOSED: "neutral",
};

// One primary ownership action per state, per the functional-hardening pass:
// a single clear next step instead of 3-4 always-visible buttons. Assign,
// Close and other rarer actions live in the "More" menu instead. CLOSED has
// no primary action — there is nothing further to do with a closed thread.
const PRIMARY_ACTION_LABEL: Partial<Record<OwnershipState, string>> = {
  HUMAN_REQUIRED: "Claim",
  HUMAN_ASSIGNED: "Claim",
  AI_ACTIVE: "Take over",
  AI_RESUME_PENDING: "Take over",
  HUMAN_ACTIVE: "Return to AI",
};

function relativeTime(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export default function InboxPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const quickCreate = useQuickCreate();
  const [channel, setChannel] = useState<ConversationChannel | "">("");
  const [ownershipState, setOwnershipState] = useState<OwnershipState | "">("");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [assignTarget, setAssignTarget] = useState("");
  // "Assign to…" is a rare action tucked in the ownership More menu — this
  // reveals the picker row it needs without giving it standing header space.
  const [assigning, setAssigning] = useState(false);
  const [confirmingClose, setConfirmingClose] = useState(false);
  // Below `md` the list and thread are two full-width screens, not two
  // squeezed columns — this tracks which one is showing.
  const [mobileView, setMobileView] = useState<"list" | "thread">("list");
  // Patient Context is a persistent 3rd column only at very wide viewports
  // (2xl+); everywhere narrower it's a toggleable drawer over the thread —
  // this is what actually fixes the "3 columns squeeze the thread" bug:
  // reclaiming the context column's ~300px instead of shrinking it.
  const [contextOpen, setContextOpen] = useState(false);

  const conversations = useQuery({
    queryKey: ["conversations", channel, ownershipState, search],
    queryFn: () => api.conversations({ channel: channel || undefined, ownershipState: ownershipState || undefined, search: search || undefined }),
  });

  const effectiveSelectedId = selectedId ?? conversations.data?.[0]?.id ?? null;

  const detail = useQuery({
    queryKey: ["conversation", effectiveSelectedId],
    queryFn: () => api.conversation(effectiveSelectedId!),
    enabled: !!effectiveSelectedId,
  });

  const lookups = useQuery({ queryKey: ["lookups"], queryFn: api.lookups });

  const selectedConversation = useMemo(
    () => conversations.data?.find((c) => c.id === effectiveSelectedId) ?? null,
    [conversations.data, effectiveSelectedId],
  );

  function selectConversation(id: string) {
    setSelectedId(id);
    setMobileView("thread");
  }

  const contextDialogRef = useDialogFocus<HTMLDivElement>(contextOpen, () => setContextOpen(false));

  // Reset per-conversation transient UI (assign picker, close confirmation) when the
  // selected conversation changes — adjusted during render rather than in an effect,
  // per React's guidance for state resets keyed off a changing value.
  const [resetForId, setResetForId] = useState(effectiveSelectedId);
  if (effectiveSelectedId !== resetForId) {
    setResetForId(effectiveSelectedId);
    setAssigning(false);
    setAssignTarget("");
    setConfirmingClose(false);
  }

  function refreshAfterAction() {
    queryClient.invalidateQueries({ queryKey: ["conversations"] });
    queryClient.invalidateQueries({ queryKey: ["conversation", effectiveSelectedId] });
  }

  async function handleClaim() {
    if (!effectiveSelectedId) return;
    await api.claimConversation(effectiveSelectedId);
    refreshAfterAction();
  }

  async function handleReturnToAi() {
    if (!effectiveSelectedId) return;
    await api.returnConversationToAi(effectiveSelectedId);
    refreshAfterAction();
  }

  async function handleClose() {
    if (!effectiveSelectedId) return;
    await api.closeConversation(effectiveSelectedId);
    setConfirmingClose(false);
    refreshAfterAction();
  }

  async function handleAssign() {
    if (!effectiveSelectedId || !assignTarget) return;
    await api.assignConversation(effectiveSelectedId, assignTarget);
    setAssignTarget("");
    setAssigning(false);
    refreshAfterAction();
  }

  async function handleSend() {
    if (!effectiveSelectedId || !draft.trim()) return;
    await api.sendConversationMessage(effectiveSelectedId, draft.trim());
    setDraft("");
    refreshAfterAction();
  }

  function openBookAppointment() {
    if (!detail.data?.patientContext || !selectedConversation) return;
    quickCreate.openNewAppointment({ patient: { id: detail.data.patientContext.patientId, name: selectedConversation.patientName, phone: "" } });
  }

  function openCreateTask() {
    if (!detail.data?.patientContext || !selectedConversation) return;
    quickCreate.openAddTask({ patient: { id: detail.data.patientContext.patientId, name: selectedConversation.patientName, phone: "" } });
  }

  function goToProfile() {
    if (!detail.data?.patientContext) return;
    router.push(withFrom(`/patients/${detail.data.patientContext.patientId}`, "inbox"));
  }

  return (
    <div className="flex h-full gap-4" data-testid="inbox-page">
      {/* Conversation list — full width on its own screen below md, a fixed-width column alongside the thread at md+. */}
      <aside
        className={`${mobileView === "thread" ? "hidden" : "flex"} w-full flex-shrink-0 flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white md:flex md:w-72 xl:w-80`}
      >
        <div className="space-y-2 border-b border-neutral-100 p-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search patient…"
            className="w-full rounded border border-neutral-200 px-2 py-1 text-xs text-slate-700"
          />
          <div className="flex gap-2">
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value as ConversationChannel | "")}
              className="flex-1 rounded border border-neutral-200 bg-white px-2 py-1 text-xs text-slate-700"
            >
              <option value="">All channels</option>
              {(Object.keys(CHANNEL_LABEL) as ConversationChannel[]).map((c) => (
                <option key={c} value={c}>{CHANNEL_LABEL[c]}</option>
              ))}
            </select>
            <select
              value={ownershipState}
              onChange={(e) => setOwnershipState(e.target.value as OwnershipState | "")}
              className="flex-1 rounded border border-neutral-200 bg-white px-2 py-1 text-xs text-slate-700"
            >
              <option value="">All states</option>
              {(Object.keys(OWNERSHIP_LABEL) as OwnershipState[]).map((s) => (
                <option key={s} value={s}>{OWNERSHIP_LABEL[s]}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.isLoading && (
            <div className="space-y-2 p-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
          )}
          {conversations.isError && <div className="p-3"><ErrorState message="Could not load conversations." /></div>}
          {conversations.data && conversations.data.length === 0 && <div className="p-3"><EmptyState message="No conversations match this filter." /></div>}
          {conversations.data?.map((c) => {
            const Icon = CHANNEL_ICON[c.channel];
            const active = c.id === effectiveSelectedId;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => selectConversation(c.id)}
                data-testid={`conversation-${c.id}`}
                className={`flex w-full flex-col gap-1 border-b border-neutral-100 px-3 py-2 text-left hover:bg-neutral-50 ${active ? "bg-primary-50" : ""}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-xs font-medium text-slate-900">
                    <Icon size={14} className="text-neutral-400" />
                    {c.patientName}
                  </span>
                  <span className="whitespace-nowrap text-[10px] text-neutral-400">{relativeTime(c.lastMessageAt)}</span>
                </div>
                <p className="truncate text-xs text-neutral-500">{c.lastMessage ?? "No messages yet"}</p>
                <div className="flex items-center justify-between">
                  <Badge tone={OWNERSHIP_TONE[c.ownershipState]}>{OWNERSHIP_LABEL[c.ownershipState]}</Badge>
                  {c.unreadCount > 0 && (
                    <span className="rounded-full bg-primary-500 px-1.5 text-[10px] font-semibold text-white">{c.unreadCount}</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      {/* Thread — the primary surface. Never shares its width with Patient Context below 2xl. */}
      <section className={`${mobileView === "list" ? "hidden" : "flex"} min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white md:flex`}>
        {!selectedConversation && <EmptyState message="Select a conversation to view messages." />}
        {selectedConversation && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 p-3">
              <div className="flex min-w-0 items-center gap-2">
                <button type="button" onClick={() => setMobileView("list")} className="shrink-0 rounded p-1 text-neutral-500 hover:bg-neutral-100 md:hidden" aria-label="Back to conversations">
                  <ArrowLeft size={18} />
                </button>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{selectedConversation.patientName}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-neutral-500">
                    {CHANNEL_LABEL[selectedConversation.channel]}
                    <Badge tone={OWNERSHIP_TONE[selectedConversation.ownershipState]}>{OWNERSHIP_LABEL[selectedConversation.ownershipState]}</Badge>
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {selectedConversation.ownershipState !== "CLOSED" && (() => {
                  const label = PRIMARY_ACTION_LABEL[selectedConversation.ownershipState];
                  if (!label) return null;
                  const onClick = selectedConversation.ownershipState === "HUMAN_ACTIVE" ? handleReturnToAi : handleClaim;
                  const testId = selectedConversation.ownershipState === "HUMAN_ACTIVE" ? "return-to-ai" : label === "Take over" ? "take-over-conversation" : "claim-conversation";
                  return (
                    <button type="button" onClick={onClick} data-testid={testId} className="rounded bg-primary-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-primary-700">
                      {label}
                    </button>
                  );
                })()}
                {selectedConversation.ownershipState !== "CLOSED" && (
                  <OverflowMenu
                    testId="conversation-more-actions"
                    items={[
                      { key: "assign", label: "Assign to…", onClick: () => setAssigning(true) },
                      { key: "close", label: "Close conversation", danger: true, onClick: () => setConfirmingClose(true) },
                    ]}
                  />
                )}
                <button
                  type="button"
                  onClick={() => setContextOpen(true)}
                  className="rounded p-1.5 text-neutral-500 hover:bg-neutral-100 2xl:hidden"
                  title="Patient context"
                  aria-label="Show patient context"
                  data-testid="open-patient-context"
                >
                  <PanelRight size={16} />
                </button>
              </div>
            </div>

            {assigning && (
              <div className="flex items-center gap-1.5 border-b border-neutral-100 bg-neutral-50 px-3 py-2">
                <span className="text-xs text-neutral-500">Assign to</span>
                <select
                  value={assignTarget}
                  onChange={(e) => setAssignTarget(e.target.value)}
                  className="rounded border border-neutral-200 bg-white px-1.5 py-1 text-xs text-slate-700"
                  autoFocus
                  data-testid="assign-target-select"
                >
                  <option value="">Choose a person…</option>
                  {lookups.data?.owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
                <button
                  type="button"
                  onClick={handleAssign}
                  disabled={!assignTarget}
                  className="rounded bg-primary-600 px-2 py-1 text-xs font-medium text-white hover:bg-primary-700 disabled:opacity-40"
                  data-testid="confirm-assign"
                >
                  Assign
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAssigning(false);
                    setAssignTarget("");
                  }}
                  className="rounded px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-100"
                >
                  Cancel
                </button>
              </div>
            )}

            <ConfirmDialog
              open={confirmingClose}
              title="Close this conversation?"
              description="No further messages will send from PulseOS on this thread, and it moves out of every active queue. You can still view its history, but reopening a closed conversation isn't currently supported — only close it once the patient's request is fully resolved."
              confirmLabel="Close conversation"
              onConfirm={handleClose}
              onCancel={() => setConfirmingClose(false)}
            />

            <div className="flex-1 space-y-3 overflow-y-auto p-3">
              {detail.isLoading && <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>}
              {detail.data?.messages.map((m) =>
                m.senderType === "system" ? (
                  <p key={m.id} className="text-center text-[11px] italic text-neutral-400">{m.body}</p>
                ) : (
                  <div key={m.id} className={`flex ${m.senderType === "patient" ? "justify-start" : "justify-end"}`}>
                    <div
                      className={`max-w-[70%] rounded-lg px-3 py-2 text-xs ${
                        m.senderType === "patient" ? "bg-neutral-100 text-slate-800" : m.senderType === "ai" ? "bg-accent-100 text-slate-800" : "bg-primary-500 text-white"
                      }`}
                    >
                      <p>{m.body}</p>
                      <p className={`mt-1 text-[10px] ${m.senderType === "staff" ? "text-primary-100" : "text-neutral-400"}`}>
                        {m.senderType === "staff" ? m.senderName ?? "Staff" : m.senderType === "ai" ? "AI Assistant" : "Patient"} · {relativeTime(m.sentAt)}
                      </p>
                    </div>
                  </div>
                ),
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-2 border-t border-neutral-100 p-3"
            >
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={selectedConversation.ownershipState === "CLOSED" ? "This conversation is closed" : "Type a message…"}
                disabled={selectedConversation.ownershipState === "CLOSED"}
                className="flex-1 rounded border border-neutral-200 px-2 py-1.5 text-xs text-slate-700 disabled:bg-neutral-50"
              />
              <button
                type="submit"
                disabled={selectedConversation.ownershipState === "CLOSED" || !draft.trim()}
                className="rounded bg-primary-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-600 disabled:opacity-40"
              >
                Send
              </button>
            </form>
          </>
        )}
      </section>

      {/* Patient Context — a real 3rd column only at very wide viewports. */}
      <aside className="hidden w-72 flex-shrink-0 overflow-y-auto rounded-lg border border-neutral-200 bg-white p-3 2xl:block xl:w-80">
        <PatientContextPanel detail={detail.data} onBook={openBookAppointment} onTask={openCreateTask} onProfile={goToProfile} />
      </aside>

      {/* Same content as a slide-over drawer everywhere narrower than 2xl. */}
      {contextOpen && (
        <div className="fixed inset-0 z-40 flex justify-end 2xl:hidden" role="dialog" aria-modal="true" aria-label="Patient context">
          <button type="button" aria-label="Close" onClick={() => setContextOpen(false)} className="absolute inset-0 bg-slate-900/30 transition-opacity duration-200 motion-reduce:transition-none" />
          <div
            ref={contextDialogRef}
            tabIndex={-1}
            className="relative flex h-full w-full max-w-xs flex-col overflow-y-auto border-l border-neutral-200 bg-white p-3 shadow-xl transition-transform duration-200 motion-reduce:transition-none focus:outline-none"
          >
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Patient context</span>
              <button type="button" onClick={() => setContextOpen(false)} aria-label="Close patient context" className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-slate-900" data-testid="close-patient-context">
                <X size={16} />
              </button>
            </div>
            <PatientContextPanel detail={detail.data} onBook={openBookAppointment} onTask={openCreateTask} onProfile={goToProfile} hideTitle />
          </div>
        </div>
      )}
    </div>
  );
}

function PatientContextPanel({
  detail,
  onBook,
  onTask,
  onProfile,
  hideTitle = false,
}: {
  detail: ConversationDetail | undefined;
  onBook: () => void;
  onTask: () => void;
  onProfile: () => void;
  hideTitle?: boolean;
}) {
  return (
    <>
      {!hideTitle && <SectionHeading title="Patient context" />}
      {!detail?.patientContext && <p className="text-xs text-neutral-400">No active journey for this patient.</p>}
      {detail?.patientContext && (
        <dl className="space-y-2 text-xs">
          <Row label="Journey" value={detail.patientContext.journeyType} />
          <Row label="Stage" value={detail.patientContext.stage?.replace(/_/g, " ") ?? null} />
          <Row label="Owner" value={detail.patientContext.ownerName} />
          <Row
            label="Next appointment"
            value={detail.patientContext.appointmentTime ? new Date(detail.patientContext.appointmentTime).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : null}
          />
          <Row
            label="Next action due"
            value={detail.patientContext.nextActionDueAt ? new Date(detail.patientContext.nextActionDueAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : null}
          />
          <Row label="Last interaction" value={detail.patientContext.lastInteractionAt ? relativeTime(detail.patientContext.lastInteractionAt) : null} />
        </dl>
      )}

      {detail?.patientContext && (
        <div className="mt-4 border-t border-neutral-100 pt-3">
          <SectionHeading title="Quick Actions" />
          <div className="space-y-1">
            <QuickActionButton icon={CalendarPlus} label="Book Appointment" onClick={onBook} />
            <QuickActionButton icon={ListPlus} label="Create Task" onClick={onTask} />
            <QuickActionButton icon={User} label="View Full Profile" onClick={onProfile} />
          </div>
        </div>
      )}
    </>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-neutral-50 pb-1.5">
      <dt className="text-neutral-500">{label}</dt>
      <dd className="text-right font-medium text-slate-800">{value ?? "—"}</dd>
    </div>
  );
}

function QuickActionButton({ icon: Icon, label, onClick }: { icon: typeof User; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-neutral-600 transition hover:bg-neutral-50 hover:text-slate-900"
    >
      <Icon size={14} className="text-neutral-400" />
      {label}
    </button>
  );
}
