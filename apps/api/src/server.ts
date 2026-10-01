import "dotenv/config";
import { buildApp } from "./app.js";
import { db } from "./db/client.js";
import { startJobRunner, type DueJob } from "./jobs/runner.js";
import { processDueConversationSummaries } from "./domain/conversation/summary/conversation-session.service.js";
import { processDueCallIntelligence } from "./domain/call/call-intelligence.service.js";
import { getTranscriber } from "./domain/call/transcriber.js";
import { getSummarizer } from "./domain/conversation/summary/index.js";

const port = Number(process.env.PORT ?? 4000);

const app = await buildApp();

// Due-time work runs from the database, not from timers held in memory: summaries of idle conversations
// now; appointment reminders next. Set JOBS_DISABLED=true to turn the runner off (e.g. a second API
// instance that should only serve requests).
const jobs: DueJob[] = [
  { name: "conversation-summaries", run: (now) => processDueConversationSummaries(db, now, getSummarizer()) },
  { name: "call-intelligence", run: (now) => processDueCallIntelligence(db, now, { transcriberFor: (mode) => getTranscriber(mode), summarizer: getSummarizer() }) },
];
const stopJobs = process.env.JOBS_DISABLED === "true" ? null : startJobRunner(jobs, { log: (msg, detail) => app.log.error({ detail }, msg) });
app.addHook("onClose", async () => stopJobs?.());

app.listen({ port, host: "0.0.0.0" }).then(() => {
  app.log.info(`PulseOS API listening on http://localhost:${port}`);
});
