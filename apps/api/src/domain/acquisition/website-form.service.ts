import type { Db } from "../../db/client.js";
import { ingestNormalizedLead } from "./lead-ingestion.service.js";
import type { NormalizedLead } from "./types.js";

export interface WebsiteFormSubmissionInput {
  formId: string;
  name: string;
  phone: string;
  email: string | null;
  service: string | null;
  language: string | null;
  branchId: string | null;
  pageUrl: string | null;
  submissionId: string;
  utm: { source: string | null; medium: string | null; campaign: string | null; content: string | null; term: string | null };
  clickIds: { gclid: string | null; gbraid: string | null; wbraid: string | null; fbclid: string | null };
  occurredAt: Date;
}

// Derives the CampaignTouchpoint's `source` enum from the submitted UTM
// source — website-form traffic almost always names a real channel, but
// falls back to "website" (never an invented value) when it doesn't.
const KNOWN_SOURCES = new Set(["meta", "google", "website", "whatsapp", "phone", "walk_in", "referral", "organic", "other"]);
function resolveSourceChannel(utmSource: string | null): NormalizedLead["source"] {
  const normalized = utmSource?.trim().toLowerCase() ?? "";
  return (KNOWN_SOURCES.has(normalized) ? normalized : "website") as NormalizedLead["source"];
}

export async function processWebsiteFormSubmission(
  db: Db,
  tenantId: string,
  input: WebsiteFormSubmissionInput,
): Promise<{ patientId: string; journeyId: string; touchpointId: string; deduped: boolean }> {
  const lead: NormalizedLead = {
    externalLeadId: input.submissionId,
    externalFormId: input.formId,
    externalAccountId: null,
    externalCampaignId: null,
    externalAdGroupId: null,
    externalAdId: null,
    name: input.name,
    phone: input.phone,
    email: input.email,
    source: resolveSourceChannel(input.utm.source),
    medium: input.utm.medium,
    utmCampaign: input.utm.campaign,
    utmContent: input.utm.content,
    utmTerm: input.utm.term,
    gclid: input.clickIds.gclid,
    gbraid: input.clickIds.gbraid,
    wbraid: input.clickIds.wbraid,
    fbclid: input.clickIds.fbclid,
    occurredAt: input.occurredAt,
    metadata: { pageUrl: input.pageUrl, formId: input.formId },
  };

  const result = await ingestNormalizedLead(db, tenantId, lead, {
    branchId: input.branchId,
    journeyTypeFallback: input.service ?? "Website Enquiry",
    campaignNameFallback: "Website – Direct",
    sourceLabel: "website",
    taskDueInHours: 2,
    firstTouchEventType: "website_form_submitted",
    firstTouchTitle: "Website enquiry received",
    additionalTouchEventType: "website_form_resubmitted",
    additionalTouchTitle: "Website form resubmitted",
    description: input.pageUrl,
  });

  return { patientId: result.patientId, journeyId: result.journeyId, touchpointId: result.touchpointId, deduped: result.journeyReused };
}
