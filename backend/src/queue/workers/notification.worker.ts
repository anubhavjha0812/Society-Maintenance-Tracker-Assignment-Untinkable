import { Worker, type Job } from "bullmq";
import type { PrismaClient } from "@prisma/client";
import { createQueueConnection } from "../connection.js";
import { QUEUE_NAMES, type NotificationJobData } from "../queues.js";
import { sendEmail } from "../../lib/email.js";

const STATUS_COPY: Record<string, string> = {
  Open: "reopened",
  InProgress: "moved to In Progress",
  Resolved: "marked Resolved",
};

/**
 * Consumes both notification event types. Before sending, it checks
 * NotificationLog for the job's idempotency key — if a row already exists
 * with status "sent", the job is a redelivery/retry and is skipped rather
 * than emailing the resident twice. Otherwise it upserts a "queued" row,
 * sends, then updates the row to "sent"/"failed".
 */
export function startNotificationWorker(prisma: PrismaClient) {
  const worker = new Worker<NotificationJobData>(
    QUEUE_NAMES.notifications,
    async (job: Job<NotificationJobData>) => {
      const idempotencyKey = job.id!;
      const data = job.data;

      const existing = await prisma.notificationLog.findUnique({ where: { idempotencyKey } });
      if (existing?.status === "sent") return;

      const { societyId, userId, eventType } =
        data.type === "complaint_status_changed"
          ? { societyId: data.societyId, userId: data.residentId, eventType: "complaint_status_changed" }
          : { societyId: data.societyId, userId: data.residentId, eventType: "notice_posted" };

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) return; // resident was removed; nothing to notify

      const logRow = await prisma.notificationLog.upsert({
        where: { idempotencyKey },
        create: { societyId, userId, channel: "email", eventType, status: "queued", idempotencyKey },
        update: {},
      });

      const { subject, body } = await buildEmail(prisma, data);

      const result = await sendEmail(user.email, subject, body);

      await prisma.notificationLog.update({
        where: { id: logRow.id },
        data: {
          status: result.ok ? "sent" : "failed",
          providerMessageId: result.providerMessageId,
        },
      });

      if (!result.ok) {
        throw new Error(result.error ?? "Email send failed");
      }
    },
    { connection: createQueueConnection(), concurrency: 5 },
  );

  worker.on("failed", (job, err) => {
    console.error(`[notification-worker] job ${job?.id} failed: ${err.message}`);
  });

  return worker;
}

async function buildEmail(prisma: PrismaClient, data: NotificationJobData) {
  if (data.type === "complaint_status_changed") {
    const complaint = await prisma.complaint.findUnique({ where: { id: data.complaintId } });
    const label = STATUS_COPY[data.newStatus] ?? data.newStatus;
    return {
      subject: `Your complaint has been ${label}`,
      body: `<p>Your complaint "${escapeHtml(complaint?.category ?? "")}" has been ${label}.</p>`,
    };
  }

  const notice = await prisma.notice.findUnique({ where: { id: data.noticeId } });
  return {
    subject: `Notice: ${notice?.title ?? "New notice"}`,
    body: `<p>${escapeHtml(notice?.body ?? "")}</p>`,
  };
}

function escapeHtml(input: string) {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
