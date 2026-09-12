import "dotenv/config";
import { db, queryClient } from "../db/client.js";
import { appointments, branches, journeys, patients, sessions, tasks, tenants, users } from "../db/schema.js";
import { hashPassword } from "../domain/auth/auth.service.js";

function requireDemoPassword(): string {
  const value = process.env.DEMO_PASSWORD;
  if (!value) {
    throw new Error("DEMO_PASSWORD env var is required to seed demo accounts");
  }
  return value;
}

const DEMO_PASSWORD: string = requireDemoPassword();

function daysFromNow(days: number, hour = 10, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  return d;
}

async function main() {
  console.log("Clearing existing demo data...");
  await db.delete(sessions);
  await db.delete(tasks);
  await db.delete(appointments);
  await db.delete(journeys);
  await db.delete(patients);
  await db.delete(users);
  await db.delete(branches);
  await db.delete(tenants);

  const [tenant] = await db.insert(tenants).values({ name: "PulseOS Demo Hospital" }).returning();

  const [branchA, branchB] = await db
    .insert(branches)
    .values([
      { tenantId: tenant.id, name: "Koramangala Centre", city: "Bengaluru" },
      { tenantId: tenant.id, name: "Whitefield Centre", city: "Bengaluru" },
    ])
    .returning();

  const passwordHash = await hashPassword(DEMO_PASSWORD);

  const [admin, doctorMeera, doctorArjun, frontDesk, coordinator] = await db
    .insert(users)
    .values([
      { tenantId: tenant.id, branchId: branchA.id, name: "Ananya Rao", email: "admin@pulseos.local", passwordHash, role: "HOSPITAL_ADMIN" },
      { tenantId: tenant.id, branchId: branchA.id, name: "Dr. Meera Iyer", email: "doctor@pulseos.local", passwordHash, role: "DOCTOR" },
      { tenantId: tenant.id, branchId: branchB.id, name: "Dr. Arjun Nair", email: "doctor2@pulseos.local", passwordHash, role: "DOCTOR" },
      { tenantId: tenant.id, branchId: branchA.id, name: "Kavya Menon", email: "frontdesk@pulseos.local", passwordHash, role: "FRONT_DESK" },
      { tenantId: tenant.id, branchId: branchA.id, name: "Rohan Das", email: "coordinator@pulseos.local", passwordHash, role: "PATIENT_COORDINATOR" },
    ])
    .returning();

  const patientNames = [
    "Priya Sharma", "Vikram Kumar", "Sneha Reddy", "Aditya Verma", "Lakshmi Nair",
    "Rahul Gupta", "Ishita Singh", "Karthik Pillai", "Divya Menon", "Arjun Patel",
    "Neha Joshi", "Suresh Iyer", "Pooja Agarwal", "Manoj Krishnan", "Ananya Desai",
    "Ravi Shankar", "Meenakshi Rao", "Siddharth Bose", "Tara Chawla", "Vishal Malhotra",
  ];

  const sources = ["meta", "google", "website", "whatsapp", "walk_in", "referral"] as const;
  const journeyTypes = ["Fertility", "Pregnancy", "Paediatrics", "General OPD"];
  const stages = ["enquiry", "contacted", "booked", "attended", "consulted", "treatment_advised", "scheduled", "completed"] as const;

  const patientRows = await db
    .insert(patients)
    .values(
      patientNames.map((name, i) => ({
        tenantId: tenant.id,
        branchId: i % 2 === 0 ? branchA.id : branchB.id,
        name,
        phone: `9${(800000000 + i * 137).toString().slice(0, 9)}`,
        preferredLanguage: i % 3 === 0 ? "Kannada" : i % 3 === 1 ? "Hindi" : "English",
      })),
    )
    .returning();

  // Priya Sharma (index 0) gets two concurrent journeys, proving Patient != Journey
  const journeyRows = [];
  for (let i = 0; i < patientRows.length; i++) {
    const patient = patientRows[i];
    const stage = stages[i % stages.length];
    const source = sources[i % sources.length];
    const jType = journeyTypes[i % journeyTypes.length];
    const owner = i % 2 === 0 ? coordinator : frontDesk;
    journeyRows.push({
      tenantId: tenant.id,
      patientId: patient.id,
      journeyType: jType,
      stage,
      source,
      ownerUserId: owner.id,
      contactedAt: stage === "enquiry" && i % 4 !== 0 ? null : daysFromNow(-i),
      createdAt: daysFromNow(-(i + 1)),
    });
  }
  journeyRows.push({
    tenantId: tenant.id,
    patientId: patientRows[0].id,
    journeyType: "Pregnancy",
    stage: "consulted" as const,
    source: "referral" as const,
    ownerUserId: coordinator.id,
    contactedAt: daysFromNow(-3),
    createdAt: daysFromNow(-10),
  });

  const insertedJourneys = await db.insert(journeys).values(journeyRows).returning();

  const doctors = [doctorMeera, doctorArjun];
  const appointmentRows = [];
  for (let i = 0; i < patientRows.length; i++) {
    const patient = patientRows[i];
    const journey = insertedJourneys[i];
    const doctor = doctors[i % 2];
    const branch = i % 2 === 0 ? branchA : branchB;
    const dayOffset = i % 5 === 0 ? 0 : i % 5 === 1 ? -1 : i % 3 === 0 ? 1 : 0;
    const status =
      dayOffset === -1 ? (i % 4 === 0 ? "no_show" : "completed") : i % 6 === 0 ? "checked_in" : i % 7 === 0 ? "with_doctor" : "scheduled";

    appointmentRows.push({
      tenantId: tenant.id,
      patientId: patient.id,
      journeyId: journey.id,
      branchId: branch.id,
      doctorUserId: doctor.id,
      status: status as typeof appointments.$inferInsert.status,
      scheduledAt: daysFromNow(dayOffset, 9 + (i % 8)),
      reason: "Consultation",
      outcomeRecorded: status === "completed" ? i % 3 !== 0 : false,
      treatmentRecommended: status === "completed" && i % 3 === 0,
      revenueAmount: status === "completed" && i % 3 === 0 ? 15000 + i * 500 : 0,
    });
  }
  await db.insert(appointments).values(appointmentRows);

  const taskReasons = ["overdue_callback", "missed_follow_up", "no_show", "high_intent_uncontacted", "treatment_decision_pending"] as const;
  const taskRows = patientRows.slice(0, 12).map((patient, i) => ({
    tenantId: tenant.id,
    patientId: patient.id,
    journeyId: insertedJourneys[i].id,
    assignedTo: i % 2 === 0 ? coordinator.id : frontDesk.id,
    reason: taskReasons[i % taskReasons.length],
    status: "pending" as const,
    dueAt: daysFromNow(i % 4 === 0 ? -1 : 0, 9 + i),
  }));
  await db.insert(tasks).values(taskRows);

  console.log("Seed complete.");
  console.log(`Tenant: ${tenant.name} (${tenant.id})`);
  console.log(`Admin login: admin@pulseos.local`);
  console.log(`Doctor login: doctor@pulseos.local`);
  console.log(`Password: value of DEMO_PASSWORD env var`);
}

main()
  .then(() => queryClient.end())
  .catch(async (err) => {
    console.error(err);
    await queryClient.end();
    process.exit(1);
  });
