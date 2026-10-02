"use client";

import Link from "next/link";
import { UserRoundCog } from "lucide-react";
import { Badge, Table, TableBody, TableHead, Td, Th, Tr, fmtDate, fmtDateTime, relativeTime, urgencyLabel } from "@pulseos/ui";
import type { LeadRow, LeadStatus } from "@pulseos/types";
import { withFrom } from "@/components/shell/BackLink";

const STATUS_LABEL: Record<LeadStatus, string> = {
  new: "New",
  uncontacted: "Uncontacted",
  follow_up_due: "Follow-up due",
  appointment_booked: "Appointment booked",
  no_response: "No response",
  converted: "Converted",
  lost: "Lost",
};
const STATUS_TONE: Record<LeadStatus, "neutral" | "warning" | "danger" | "primary"> = {
  new: "primary", uncontacted: "neutral", follow_up_due: "warning", appointment_booked: "primary", no_response: "danger", converted: "primary", lost: "neutral",
};

/**
 * The Leads table: who, what they enquired about, where they came from, where they stand, who owns them, what
 * happened last and what happens next (from Tasks). The whole row opens the Journey.
 */
export function LeadsTable({
  rows,
  canAssign,
  selected,
  allSelected,
  onToggle,
  onToggleAll,
  onOpen,
  onAssign,
}: {
  rows: LeadRow[];
  canAssign: boolean;
  selected: Set<string>;
  allSelected: boolean;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  onOpen: (lead: LeadRow) => void;
  onAssign: (lead: LeadRow) => void;
}) {
  return (
    <Table className="min-w-[1040px]">
      <TableHead>
        <tr>
          {canAssign && (
            <Th leading className="w-10">
              <input type="checkbox" checked={allSelected} onChange={onToggleAll} aria-label="Select all leads" data-testid="lead-select-all" />
            </Th>
          )}
          <Th leading={!canAssign}>Patient</Th>
          <Th>Enquiry</Th>
          <Th>Original source</Th>
          <Th>Status</Th>
          <Th>Owner</Th>
          <Th>Last interaction</Th>
          <Th>Next action</Th>
          <Th>Enquiry date</Th>
        </tr>
      </TableHead>
      <TableBody>
        {rows.map((lead) => {
          const due = lead.nextAction ? urgencyLabel(lead.nextAction.dueAt) : null;
          return (
            <Tr key={lead.id} onClick={() => onOpen(lead)} data-testid={`lead-row-${lead.id}`} data-stage={lead.stage}>
              {canAssign && (
                <Td leading className="w-10" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={selected.has(lead.id)} onChange={() => onToggle(lead.id)} aria-label={`Select ${lead.patientName}`} data-testid={`lead-select-${lead.id}`} />
                </Td>
              )}
              <Td leading={!canAssign}>
                <Link href={withFrom(`/journeys/${lead.id}`, "leads")} onClick={(e) => e.stopPropagation()} className="block font-medium text-ink hover:text-primary-700 hover:underline">
                  {lead.patientName}
                </Link>
                <span className="block text-[11px] text-ink-2">{lead.phone}</span>
              </Td>
              <Td className="text-ink-2" data-testid={`lead-enquiry-${lead.id}`}>
                <span className="block text-ink">{lead.journeyType}</span>
                {lead.specialtyLabel && lead.specialtyLabel !== lead.journeyType && <span className="block text-[11px] text-neutral-500">{lead.specialtyLabel}</span>}
              </Td>
              <Td className="text-ink-2">
                <span className="block">{lead.sourceLabel}</span>
                {lead.campaignName && <span className="block max-w-[10rem] truncate text-[11px] text-neutral-500">{lead.campaignName}</span>}
              </Td>
              <Td>
                <Badge tone={STATUS_TONE[lead.leadStatus]}>{STATUS_LABEL[lead.leadStatus]}</Badge>
                {lead.outcomeLabel && <span className="mt-0.5 block text-[11px] text-ink-2" data-testid={`lead-outcome-${lead.id}`}>{lead.outcomeLabel}</span>}
              </Td>
              <Td>
                <span className="flex items-center gap-1.5">
                  <span className={lead.ownerName ? "text-ink" : "text-ink-2"} data-testid={`lead-owner-${lead.id}`}>
                    {lead.ownerName ?? "Unassigned"}
                  </span>
                  {canAssign && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAssign(lead);
                      }}
                      aria-label={`${lead.ownerName ? "Change" : "Assign"} owner for ${lead.patientName}`}
                      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-chip text-primary-700 hover:bg-primary-50"
                      data-testid={`assign-owner-${lead.id}`}
                    >
                      <UserRoundCog size={14} aria-hidden="true" />
                    </button>
                  )}
                </span>
              </Td>
              <Td className="text-ink-2">{relativeTime(lead.lastInteractionAt)}</Td>
              <Td data-testid={`lead-next-${lead.id}`}>
                {lead.nextAction && due ? (
                  <>
                    <span className="block text-ink">{lead.nextAction.label}</span>
                    <span className={`block text-[11px] ${due.overdue ? "font-medium text-danger-700" : "text-neutral-500"}`}>{due.text} · {fmtDateTime(lead.nextAction.dueAt)}</span>
                  </>
                ) : (
                  <span className="text-neutral-500">—</span>
                )}
              </Td>
              <Td className="text-ink-2">
                <span className="block">{fmtDate(lead.createdAt)}</span>
                {lead.nextAppointment ? (
                  <span className="block text-[11px] text-primary-700" data-testid={`lead-visit-${lead.id}`}>Visit {fmtDateTime(lead.nextAppointment.at)}</span>
                ) : (
                  <span className="block text-[11px] text-neutral-500">{relativeTime(lead.createdAt)}</span>
                )}
              </Td>
            </Tr>
          );
        })}
      </TableBody>
    </Table>
  );
}
