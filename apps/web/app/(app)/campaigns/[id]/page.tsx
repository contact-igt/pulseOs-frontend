"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@pulseos/api-client";
import { Badge, Card, ConnectorModeBadge, EmptyState, ErrorState, MetricStrip, SectionHeading, Skeleton, Table, TableBody, TableHead, Td, Th, Tr, formatInr, formatMoneyOrDash, formatRoas } from "@pulseos/ui";
import { BackLink, withFrom } from "@/components/shell/BackLink";

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function CampaignDetailPage() {
  const params = useParams<{ id: string }>();
  const campaignId = params.id;

  const performance = useQuery({
    queryKey: ["campaign-performance", campaignId],
    queryFn: () => api.campaignPerformance({ campaignId }),
  });
  const campaign = performance.data?.[0];

  const journeyList = useQuery({
    queryKey: ["journeys", { campaignId }],
    queryFn: () => api.journeys({ campaignId }),
    enabled: performance.isSuccess && !!campaign,
  });

  if (performance.isLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-5">
        <Skeleton className="h-20" />
        <Skeleton className="h-24" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (performance.isError) {
    return <ErrorState message="Could not load this campaign." />;
  }

  if (!campaign) {
    return (
      <div className="mx-auto max-w-6xl space-y-5">
        <BackLink fallback="/campaigns" fallbackLabel="Back to Campaigns" />
        <ErrorState message="This campaign could not be found." />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5" data-testid="campaign-detail-page">
      <BackLink fallback="/campaigns" fallbackLabel="Back to Campaigns" />

      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold text-slate-900">{campaign.campaignName}</h1>
              <ConnectorModeBadge mode={campaign.connectorMode} />
            </div>
            <p className="mt-1 text-sm text-neutral-500">
              {campaign.source}
              {campaign.specialtyLabel ? ` · ${campaign.specialtyLabel}` : ""}
            </p>
          </div>
          {journeyList.data && journeyList.data.length > 0 && (
            <span className="text-xs text-neutral-400">
              First attributed {fmtDate([...journeyList.data].sort((a, b) => a.lastActivityAt.localeCompare(b.lastActivityAt))[0].lastActivityAt)}
            </span>
          )}
        </div>
      </Card>

      <MetricStrip
        testId="campaign-detail-metrics"
        cells={[
          { key: "spend", label: "Spend", value: formatInr(campaign.spend) },
          { key: "leads", label: "Leads", value: campaign.leads },
          { key: "appointments", label: "Appointments", value: campaign.appointments },
          { key: "consultations", label: "Consultations", value: campaign.consultations },
          { key: "treatmentAdvised", label: "Tx Advised", value: campaign.treatmentAdvised },
          { key: "treatmentCompleted", label: "Tx Completed", value: campaign.treatmentCompleted },
          { key: "revenue", label: "Revenue", value: formatInr(campaign.revenue) },
          { key: "roas", label: "ROAS", value: formatRoas(campaign.roas) },
          { key: "cpl", label: "Cost / Lead", value: formatMoneyOrDash(campaign.cpl) },
          { key: "cpt", label: "Cost / Treatment", value: formatMoneyOrDash(campaign.costPerTreatment) },
        ]}
      />

      <Card className="overflow-x-auto p-4">
        <SectionHeading title="Attribution / Journeys" subtitle={journeyList.data ? `${journeyList.data.length} journeys` : undefined} />
        {journeyList.isLoading && <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8" />)}</div>}
        {journeyList.isError && <ErrorState message="Could not load attributed journeys." />}
        {journeyList.data && journeyList.data.length === 0 && <EmptyState message="No journeys attributed to this campaign yet." />}
        {journeyList.data && journeyList.data.length > 0 && (
          <Table className="min-w-[720px]">
            <TableHead>
              <tr>
                <Th leading>Patient</Th>
                <Th>Journey type</Th>
                <Th>Stage</Th>
                <Th>Doctor</Th>
                <Th>Last activity</Th>
                <Th align="right">Treatment value</Th>
              </tr>
            </TableHead>
            <TableBody>
              {journeyList.data.map((row) => (
                <Tr key={row.id} data-testid={`campaign-journey-row-${row.id}`}>
                  <Td leading>
                    <Link href={withFrom(`/patients/${row.patientId}`, "campaigns")} className="font-medium text-primary-700 hover:underline">
                      {row.patientName}
                    </Link>
                  </Td>
                  <Td className="text-neutral-600">{row.journeyType}</Td>
                  <Td><Badge tone={row.stage === "lost" ? "danger" : "primary"}>{row.stage.replace(/_/g, " ")}</Badge></Td>
                  <Td className="text-neutral-600">{row.doctorName ?? "—"}</Td>
                  <Td className="text-neutral-600">{fmtDate(row.lastActivityAt)}</Td>
                  <Td align="right">{formatInr(row.treatmentValue)}</Td>
                </Tr>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
