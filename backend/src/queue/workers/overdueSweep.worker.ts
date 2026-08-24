import { Worker } from "bullmq";
import type { PrismaClient } from "@prisma/client";
import { createQueueConnection } from "../connection.js";
import { QUEUE_NAMES, overdueSweepQueue } from "../queues.js";

const SWEEP_INTERVAL_MS = 5 * 60 * 1000; // every 5 minutes
const REPEAT_JOB_ID = "overdue-sweep-repeat";

/**
 * Single set-based UPDATE across every society at once, each society
 * compared against its own overdue_threshold_days — this is the "checks
 * each society's overdue_threshold_days" requirement from the spec,
 * without a per-complaint loop and without computing overdue status
 * inline on every read (the spec explicitly rules that out).
 */
export function startOverdueSweepWorker(prisma: PrismaClient) {
  const worker = new Worker(
    QUEUE_NAMES.overdueSweep,
    async () => {
      const affected = await prisma.$executeRaw`
        UPDATE complaints c
        SET is_overdue = true
        FROM societies s
        WHERE c.society_id = s.id
          AND c.current_status = 'Open'
          AND c.is_overdue = false
          AND c.created_at <= now() - make_interval(days => s.overdue_threshold_days)
      `;
      if (affected > 0) {
        console.log(`[overdue-sweep] marked ${affected} complaint(s) overdue`);
      }
    },
    { connection: createQueueConnection() },
  );

  worker.on("failed", (job, err) => {
    console.error(`[overdue-sweep] job ${job?.id} failed: ${err.message}`);
  });

  return worker;
}

export async function scheduleOverdueSweep() {
  await overdueSweepQueue.add(
    "sweep",
    {},
    {
      repeat: { every: SWEEP_INTERVAL_MS },
      jobId: REPEAT_JOB_ID,
    },
  );
}
