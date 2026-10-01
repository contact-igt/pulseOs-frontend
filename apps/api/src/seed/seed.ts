import "dotenv/config";
import { db, queryClient } from "../db/client.js";
import {
  sessions,
  calls,
  connectorEvents,
  messages,
  conversationSummaries,
  allocationRules,
  crmOutcomes,
  tenantSettings,
  conversationAutomationPreferences,
  conversations,
  timelineEvents,
  revenueEvents,
  conversionFeedbackEvents,
  treatmentOpportunities,
  treatmentDefinitions,
  consultationOutcomes,
  tasks,
  campaignTouchpoints,
  appointments,
  customFieldValues,
  journeys,
  marketingCampaigns,
  patients,
  users,
  communicationEndpoints,
  branches,
  connectorSecrets,
  gbpPerformanceMetrics,
  connectors,
  customFieldDefinitions,
  specialtyTemplates,
  tenants,
} from "../db/schema.js";
import { assertSafeToWipe } from "./safety.js";
import { hashPassword } from "../domain/auth/auth.service.js";
import { DEMO_ENVIRONMENTS, DEMO_STAFF_SLUGS } from "../domain/auth/demo-environments.js";
import { seedGynecologyTenant } from "./demo/gynecology.js";
import { seedOphthalmologyTenant } from "./demo/ophthalmology.js";
import { seedConversationSessions } from "./demo/conversation-sessions.js";

function requireDemoPassword(): string {
  const value = process.env.DEMO_PASSWORD;
  if (!value) {
    throw new Error("DEMO_PASSWORD env var is required to seed demo accounts");
  }
  return value;
}

// Wipes every tenant and re-creates BOTH demo tenants from scratch, so
// running the seed any number of times yields the same clean, deterministic
// state — never duplicated tenants, users, patients or communications.
// Demo data is per-tenant (demo/gynecology.ts, demo/ophthalmology.ts); the
// two share only the row builders in demo/shared.ts.
async function main() {
  assertSafeToWipe(process.env);
  const demoPassword = requireDemoPassword();

  console.log("Clearing existing demo data...");
  await db.delete(sessions);
  await db.delete(calls);
  await db.delete(connectorEvents);
  await db.delete(conversationSummaries);
  await db.delete(messages);
  await db.delete(conversationAutomationPreferences);
  await db.delete(conversations);
  await db.delete(timelineEvents);
  await db.delete(revenueEvents);
  await db.delete(conversionFeedbackEvents);
  await db.delete(treatmentOpportunities);
  await db.delete(treatmentDefinitions);
  await db.delete(consultationOutcomes);
  await db.delete(tasks);
  await db.delete(campaignTouchpoints);
  await db.delete(appointments);
  await db.delete(customFieldValues);
  await db.delete(journeys);
  await db.delete(crmOutcomes);
  await db.delete(allocationRules);
  await db.delete(marketingCampaigns);
  await db.delete(patients);
  await db.delete(users);
  await db.delete(communicationEndpoints);
  await db.delete(branches);
  await db.delete(connectorSecrets);
  await db.delete(gbpPerformanceMetrics);
  await db.delete(connectors);
  await db.delete(customFieldDefinitions);
  await db.delete(specialtyTemplates);
  await db.delete(tenantSettings);
  await db.delete(tenants);

  const passwordHash = await hashPassword(demoPassword);
  await seedGynecologyTenant(passwordHash);
  await seedOphthalmologyTenant(passwordHash);
  // Each WhatsApp thread gets its session line on the Timeline and a (FIXTURE-labelled) summary, exactly as
  // live traffic does once a conversation has been idle.
  await seedConversationSessions();

  console.log("Seed complete. Password for every demo account: value of DEMO_PASSWORD env var");
  for (const env of DEMO_ENVIRONMENTS) {
    const logins = DEMO_STAFF_SLUGS.map((slug) => `${env.emailPrefix}.${slug}`).join(" / ");
    console.log(`${env.label}: ${logins} @pulseos.local`);
  }
}

main()
  .then(() => queryClient.end())
  .catch(async (err) => {
    console.error(err);
    await queryClient.end();
    process.exit(1);
  });
