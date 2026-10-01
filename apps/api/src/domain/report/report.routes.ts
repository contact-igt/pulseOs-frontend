import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { ReportExportKind, ReportQuery } from "@pulseos/types";
import { branches, leadSources, scheduleResources, tenants, users } from "../../db/schema.js";
import { requirePermission } from "../auth/permission.middleware.js";
import { getOperationsReport, getReportFilterOptions } from "./operations-report.service.js";
import { buildReportWorkbook, ExportTooLargeError } from "./report-export.service.js";
import { ReportInputError } from "./report-period.js";

const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);
const opt = <T extends z.ZodTypeAny>(schema: T) => z.preprocess(emptyToUndefined, schema.optional());

// Unknown keys (a smuggled tenantId…) are stripped — the tenant always comes from the session.
const querySchema = z.object({
  range: opt(z.enum(["today", "yesterday", "7d", "30d", "this_month", "last_month", "custom"])),
  from: opt(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  to: opt(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  branchId: opt(z.string().uuid()),
  service: opt(z.string().min(1).max(120)),
  sourceId: opt(z.string().uuid()),
  ownerId: opt(z.string().uuid()),
  doctorId: opt(z.string().uuid()),
});

const exportSchema = querySchema.extend({ kind: z.enum(["summary", "enquiries", "appointments", "follow-ups"]) });

function badQuery(reply: FastifyReply, issues: z.ZodIssue[]) {
  return reply.status(400).send({ error: "invalid_query", issues: issues.map((i) => ({ path: i.path.join("."), message: i.message })) });
}

/** Human-readable "Branch: Andheri" lines for the workbook's About sheet. Ids are looked up in THIS tenant only. */
async function filterLabels(app: FastifyInstance, tenantId: string, q: ReportQuery): Promise<[string, string][]> {
  const out: [string, string][] = [];
  const one = async <T extends { name: string }>(p: Promise<T[]>) => (await p)[0]?.name ?? "(not found)";
  if (q.branchId) out.push(["Branch", await one(app.db.select({ name: branches.name }).from(branches).where(and(eq(branches.tenantId, tenantId), eq(branches.id, q.branchId))))]);
  if (q.service) out.push(["Service", q.service]);
  if (q.sourceId) out.push(["Source", await one(app.db.select({ name: leadSources.label }).from(leadSources).where(and(eq(leadSources.tenantId, tenantId), eq(leadSources.id, q.sourceId))))]);
  if (q.ownerId) out.push(["Owner / assignee", await one(app.db.select({ name: users.name }).from(users).where(and(eq(users.tenantId, tenantId), eq(users.id, q.ownerId))))]);
  if (q.doctorId) out.push(["Doctor", await one(app.db.select({ name: scheduleResources.name }).from(scheduleResources).where(and(eq(scheduleResources.tenantId, tenantId), eq(scheduleResources.id, q.doctorId))))]);
  if (out.length === 0) out.push(["Filters", "None — whole hospital"]);
  return out;
}

export async function reportRoutes(app: FastifyInstance) {
  // The operations report is the hospital-management view (Command Centre): admin roles only, every edition.
  app.addHook("preHandler", requirePermission("VIEW_ADMIN_COMMAND_CENTRE"));

  app.get("/reports/filter-options", async (request) => getReportFilterOptions(app.db, request.sessionUser!.tenantId));

  app.get("/reports/operations", async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = querySchema.safeParse(request.query);
    if (!parsed.success) return badQuery(reply, parsed.error.issues);
    try {
      return await getOperationsReport(app.db, request.sessionUser!.tenantId, parsed.data as ReportQuery);
    } catch (err) {
      if (err instanceof ReportInputError) return reply.status(400).send({ error: "invalid_query", message: err.message });
      throw err;
    }
  });

  app.get("/reports/export", { preHandler: requirePermission("EXPORT_REPORTS") }, async (request, reply) => {
    const parsed = exportSchema.safeParse(request.query);
    if (!parsed.success) return badQuery(reply, parsed.error.issues);
    const { kind, ...q } = parsed.data;
    const user = request.sessionUser!;
    try {
      const [tenant] = await app.db.select({ name: tenants.name }).from(tenants).where(eq(tenants.id, user.tenantId));
      const { buffer, filename, rows } = await buildReportWorkbook(app.db, user.tenantId, kind as ReportExportKind, q as ReportQuery, {
        hospital: tenant?.name ?? "Hospital",
        generatedBy: user.name,
        filterLabels: await filterLabels(app, user.tenantId, q as ReportQuery),
      });
      // Who exported what, how much — never the rows themselves.
      request.log.info({ export: { kind, rows, userId: user.id, tenantId: user.tenantId, range: q.range ?? "30d" } }, "report exported");
      return reply
        .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        .header("Content-Disposition", `attachment; filename="${filename}"`)
        // The web app is another origin (3310 → 4310): without this the browser hides the filename from fetch().
        .header("Access-Control-Expose-Headers", "Content-Disposition")
        .header("Cache-Control", "no-store")
        .header("X-Content-Type-Options", "nosniff")
        .send(buffer);
    } catch (err) {
      if (err instanceof ReportInputError) return reply.status(400).send({ error: "invalid_query", message: err.message });
      if (err instanceof ExportTooLargeError) return reply.status(413).send({ error: "export_too_large", message: err.message });
      throw err;
    }
  });
}
