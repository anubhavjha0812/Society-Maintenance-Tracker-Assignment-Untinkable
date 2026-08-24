import "dotenv/config";
import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { startNotificationWorker } from "./queue/workers/notification.worker.js";
import { startOverdueSweepWorker, scheduleOverdueSweep } from "./queue/workers/overdueSweep.worker.js";

async function main() {
  const app = await buildApp();

  // BullMQ worker + repeatable overdue-sweep job run inside this same
  // process, started right after the API is listening. Render's free
  // tier has no standalone background-worker product, so queued jobs
  // (overdue sweep, notification sends) only get processed while this
  // service is awake/receiving traffic — an accepted MVP tradeoff,
  // documented in README.md's scaling notes.
  const notificationWorker = startNotificationWorker(app.prisma);
  const overdueSweepWorker = startOverdueSweepWorker(app.prisma);
  await scheduleOverdueSweep();

  app.addHook("onClose", async () => {
    await Promise.all([notificationWorker.close(), overdueSweepWorker.close()]);
  });

  try {
    await app.listen({ port: env.PORT, host: "0.0.0.0" });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
