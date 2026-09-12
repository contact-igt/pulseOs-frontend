import "dotenv/config";
import { buildApp } from "./app.js";

const port = Number(process.env.PORT ?? 4000);

const app = await buildApp();

app.listen({ port, host: "0.0.0.0" }).then(() => {
  app.log.info(`PulseOS API listening on http://localhost:${port}`);
});
