import { Queue } from "bullmq";
import { createQueueConnection } from "./connection.js";

export const QUEUE_NAMES = {
  overdueSweep: "overdue-sweep",
  notifications: "notifications",
} as const;

const connection = createQueueConnection();

export const overdueSweepQueue = new Queue(QUEUE_NAMES.overdueSweep, { connection });
export const notificationsQueue = new Queue(QUEUE_NAMES.notifications, { connection });

export interface StatusChangeNotificationJob {
  type: "complaint_status_changed";
  complaintId: string;
  societyId: string;
  residentId: string;
  newStatus: "Open" | "InProgress" | "Resolved";
  historyId: string;
}

export interface NoticeFanoutJob {
  type: "notice_posted";
  noticeId: string;
  societyId: string;
  residentId: string;
}

export type NotificationJobData = StatusChangeNotificationJob | NoticeFanoutJob;

/**
 * jobId is set to the same value we'll use as NotificationLog's unique
 * idempotency_key, so BullMQ itself refuses to enqueue a literal duplicate
 * job, and the worker's own DB check (see notification.worker.ts) covers
 * the case where a job is retried/redelivered after partially succeeding.
 */
export async function enqueueStatusChangeNotification(
  args: Omit<StatusChangeNotificationJob, "type">,
) {
  const idempotencyKey = `complaint_status_changed:${args.historyId}`;
  await notificationsQueue.add(
    "notify",
    { type: "complaint_status_changed", ...args } satisfies StatusChangeNotificationJob,
    { jobId: idempotencyKey, attempts: 3, backoff: { type: "exponential", delay: 5000 } },
  );
}

export async function enqueueNoticeFanout(args: Omit<NoticeFanoutJob, "type">) {
  const idempotencyKey = `notice_posted:${args.noticeId}:${args.residentId}`;
  await notificationsQueue.add(
    "notify",
    { type: "notice_posted", ...args } satisfies NoticeFanoutJob,
    { jobId: idempotencyKey, attempts: 3, backoff: { type: "exponential", delay: 5000 } },
  );
}
