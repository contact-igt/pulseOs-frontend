import { execFileSync } from "node:child_process";

// E2E specs run against the live dev DB (the one the dev API uses). Fixtures are
// fictional patients whose names carry a spec-specific marker; `purgePatients`
// removes them and every row hanging off them, pass or fail, so the demo
// tenants never accumulate test journeys, tasks or appointments.

const DATABASE_URL = process.env.E2E_DATABASE_URL ?? "postgres://localhost:5432/pulseos_dev";

export function sql(statement: string): string {
  return execFileSync("psql", [DATABASE_URL, "-v", "ON_ERROR_STOP=1", "-q", "-At", "-F", "|", "-c", statement], { encoding: "utf8" }).trim();
}

/** Delete test patients whose name starts with `namePrefix` (demo tenants only) and everything that references them. */
export function purgePatients(namePrefix: string) {
  if (namePrefix.trim().length < 2) throw new Error("purgePatients needs a specific marker prefix");
  const escaped = namePrefix.replace(/'/g, "''").replace(/[\\%_]/g, "\\$&");
  const ps = `SELECT p.id FROM patients p JOIN tenants t ON t.id = p.tenant_id WHERE t.name LIKE 'PulseOS % Demo' AND p.name LIKE '${escaped}%'`;
  const cs = `SELECT id FROM conversations WHERE patient_id IN (${ps})`;
  sql(`
    BEGIN;
    DELETE FROM revenue_events WHERE patient_id IN (${ps});
    DELETE FROM conversion_feedback_events WHERE patient_id IN (${ps});
    DELETE FROM treatment_opportunities WHERE patient_id IN (${ps});
    DELETE FROM consultation_outcomes WHERE patient_id IN (${ps});
    DELETE FROM messages WHERE conversation_id IN (${cs});
    DELETE FROM conversation_automation_preferences WHERE conversation_id IN (${cs});
    DELETE FROM conversations WHERE patient_id IN (${ps});
    DELETE FROM calls WHERE patient_id IN (${ps});
    DELETE FROM campaign_touchpoints WHERE patient_id IN (${ps});
    DELETE FROM custom_field_values WHERE journey_id IN (SELECT id FROM journeys WHERE patient_id IN (${ps}));
    DELETE FROM timeline_events WHERE patient_id IN (${ps});
    DELETE FROM tasks WHERE patient_id IN (${ps});
    DELETE FROM appointments WHERE patient_id IN (${ps});
    DELETE FROM journeys WHERE patient_id IN (${ps});
    DELETE FROM patients WHERE id IN (${ps});
    COMMIT;`);
}
