"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@pulseos/api-client";
import { useRouter } from "next/navigation";
import { Badge, EmptyState, ErrorState, SectionHeading, Skeleton } from "@pulseos/ui";
import type { ConversationChannel, OwnershipState } from "@pulseos/types";
import { CalendarPlus, ListPlus, Mail, MessageCircle, MessageSquareText, Phone, User, Users as UsersIcon } from "lucide-react";

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
  const [channel, setChannel] = useState<ConversationChannel | "">("");
  const [ownershipState, setOwnershipState] = useState<OwnershipState | "">("");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [assignTarget, setAssignTarget] = useState("");

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
    refreshAfterAction();
  }

  async function handleAssign() {
    if (!effectiveSelectedId || !assignTarget) return;
    await api.assignConversation(effectiveSelectedId, assignTarget);
    setAssignTarget("");
    refreshAfterAction();
  }

  async function handleSend() {
    if (!effectiveSelectedId || !draft.trim()) return;
    await api.sendConversationMessage(effectiveSelectedId, draft.trim());
    setDraft("");
    refreshAfterAction();
  }

  return (
    <div className="flex h-full gap-4" data-testid="inbox-page">
      <aside className="flex w-64 flex-shrink-0 flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white lg:w-80">
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
                onClick={() => setSelectedId(c.id)}
                data-testid={`conversation-${c.id}`}
                className={`flex w-full flex-col gap-1 border-b border-neutral-100 px-3 py-2 text-left hover:bg-neutral-50 ${active ? "bg-primary-50" : ""}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-xs font-medium text-slate-900">
                    <Icon size={13} className="text-neutral-400" />
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

      <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white">
        {!selectedConversation && <EmptyState message="Select a conversation to view messages." />}
        {selectedConversation && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 p-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">{selectedConversation.patientName}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-neutral-500">
                  {CHANNEL_LABEL[selectedConversation.channel]}
                  <Badge tone={OWNERSHIP_TONE[selectedConversation.ownershipState]}>{OWNERSHIP_LABEL[selectedConversation.ownershipState]}</Badge>
                </p>
              </div>
              <div className="flex items-center gap-2">
                {selectedConversation.ownershipState !== "CLOSED" && selectedConversation.ownershipState !== "HUMAN_ACTIVE" && (
                  <button type="button" onClick={handleClaim} data-testid="claim-conversation" className="rounded border border-neutral-200 px-2 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100">
                    Claim
                  </button>
                )}
                {selectedConversation.ownershipState !== "CLOSED" && selectedConversation.ownershipState !== "AI_ACTIVE" && selectedConversation.ownershipState !== "AI_RESUME_PENDING" && (
                  <button type="button" onClick={handleReturnToAi} data-testid="return-to-ai" className="rounded border border-neutral-200 px-2 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100">
                    Return to AI
                  </button>
                )}
                {selectedConversation.ownershipState !== "CLOSED" && (
                  <button type="button" onClick={handleClose} data-testid="close-conversation" className="rounded border border-neutral-200 px-2 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100">
                    Close
                  </button>
                )}
                {selectedConversation.ownershipState !== "CLOSED" && (
                  <div className="flex items-center gap-1">
                    <select
                      value={assignTarget}
                      onChange={(e) => setAssignTarget(e.target.value)}
                      className="rounded border border-neutral-200 bg-white px-1.5 py-1 text-xs text-slate-700"
                    >
                      <option value="">Assign to…</option>
                      {lookups.data?.owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                    </select>
                    <button
                      type="button"
                      onClick={handleAssign}
                      disabled={!assignTarget}
                      className="rounded border border-neutral-200 px-2 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-40"
                    >
                      Assign
                    </button>
                  </div>
                )}
              </div>
            </div>

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

      <aside className="hidden w-72 flex-shrink-0 overflow-y-auto rounded-lg border border-neutral-200 bg-white p-3 lg:block">
        <SectionHeading title="Patient context" />
        {!detail.data?.patientContext && <p className="text-xs text-neutral-400">No active journey for this patient.</p>}
        {detail.data?.patientContext && (
          <dl className="space-y-2 text-xs">
            <Row label="Journey" value={detail.data.patientContext.journeyType} />
            <Row label="Stage" value={detail.data.patientContext.stage?.replace(/_/g, " ") ?? null} />
            <Row label="Owner" value={detail.data.patientContext.ownerName} />
            <Row
              label="Next appointment"
              value={detail.data.patientContext.appointmentTime ? new Date(detail.data.patientContext.appointmentTime).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : null}
            />
            <Row
              label="Next action due"
              value={detail.data.patientContext.nextActionDueAt ? new Date(detail.data.patientContext.nextActionDueAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : null}
            />
            <Row label="Last interaction" value={detail.data.patientContext.lastInteractionAt ? relativeTime(detail.data.patientContext.lastInteractionAt) : null} />
          </dl>
        )}

        {detail.data?.patientContext && (
          <div className="mt-4 border-t border-neutral-100 pt-3">
            <SectionHeading title="Quick Actions" />
            <div className="space-y-1">
              <QuickActionButton icon={CalendarPlus} label="Book Appointment" onClick={() => router.push("/appointments")} />
              <QuickActionButton icon={ListPlus} label="Create Task" onClick={() => router.push("/my-work")} />
              <QuickActionButton
                icon={User}
                label="View Full Profile"
                onClick={() => router.push(`/patients/${detail.data!.patientContext!.patientId}`)}
              />
            </div>
          </div>
        )}
      </aside>
    </div>
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
