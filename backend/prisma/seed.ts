import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";

/**
 * Seeds 3 demo societies, one admin + a few residents per society, sample
 * complaints spanning every status (including one old enough to trigger
 * the overdue sweep), and a couple of notices per society. Every seeded
 * account uses the password "Password123!" — see the printed summary at
 * the end for exact emails/invite codes.
 *
 * Password hashes are produced with Better-Auth's own hashPassword() (not
 * a hand-rolled bcrypt call) so these accounts can actually sign in
 * through the real auth flow afterwards.
 */

const prisma = new PrismaClient();
const DEMO_PASSWORD = "Password123!";

const SOCIETIES = [
  {
    name: "Willowbrook Residency",
    inviteCode: "WILLOW01",
    overdueThresholdDays: 7,
    admin: { name: "Priya Nair", email: "admin@willowbrook.test" },
    residents: [
      { name: "Rahul Mehta", email: "rahul@willowbrook.test", flatNumber: "A-101" },
      { name: "Sana Iyer", email: "sana@willowbrook.test", flatNumber: "A-204" },
      { name: "Kabir Singh", email: "kabir@willowbrook.test", flatNumber: "B-302" },
    ],
  },
  {
    name: "Palm Court Apartments",
    inviteCode: "PALM0002",
    overdueThresholdDays: 5,
    admin: { name: "Anil Rao", email: "admin@palmcourt.test" },
    residents: [
      { name: "Divya Kulkarni", email: "divya@palmcourt.test", flatNumber: "C-11" },
      { name: "Farhan Sheikh", email: "farhan@palmcourt.test", flatNumber: "C-45" },
    ],
  },
  {
    name: "Riverside Heights",
    inviteCode: "RIVER003",
    overdueThresholdDays: 10,
    admin: { name: "Meera Pillai", email: "admin@riverside.test" },
    residents: [
      { name: "Vikram Joshi", email: "vikram@riverside.test", flatNumber: "T2-708" },
      { name: "Aisha Khan", email: "aisha@riverside.test", flatNumber: "T1-112" },
    ],
  },
];

async function createUser(args: {
  societyId: string;
  name: string;
  email: string;
  role: "resident" | "society_admin";
  flatNumber?: string;
}) {
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  return prisma.user.create({
    data: {
      societyId: args.societyId,
      name: args.name,
      email: args.email,
      passwordHash,
      role: args.role,
      flatNumber: args.flatNumber,
    },
  });
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

async function main() {
  console.log("Seeding database...\n");

  for (const def of SOCIETIES) {
    const society = await prisma.society.create({
      data: {
        name: def.name,
        inviteCode: def.inviteCode,
        overdueThresholdDays: def.overdueThresholdDays,
      },
    });

    const admin = await createUser({
      societyId: society.id,
      name: def.admin.name,
      email: def.admin.email,
      role: "society_admin",
    });

    const residents = await Promise.all(
      def.residents.map((r) =>
        createUser({ societyId: society.id, name: r.name, email: r.email, role: "resident", flatNumber: r.flatNumber }),
      ),
    );

    // One complaint per resident spanning every status, plus a second,
    // deliberately old Open complaint on the first resident so it
    // qualifies as overdue against this society's own threshold.
    const categories = ["Plumbing", "Electrical", "Cleanliness", "Security", "Parking"];
    const firstResident = residents[0]!;

    const oldOpenComplaint = await prisma.complaint.create({
      data: {
        societyId: society.id,
        residentId: firstResident.id,
        category: "Plumbing",
        description: "Leaking pipe under the kitchen sink, water pooling on the floor.",
        priority: "High",
        currentStatus: "Open",
        isOverdue: true, // seeded pre-marked; the sweep job will also catch it going forward
        createdAt: daysAgo(def.overdueThresholdDays + 4),
      },
    });
    await prisma.complaintStatusHistory.create({
      data: {
        complaintId: oldOpenComplaint.id,
        societyId: society.id,
        status: "Open",
        actorId: firstResident.id,
        timestamp: oldOpenComplaint.createdAt,
      },
    });

    for (const [i, resident] of residents.entries()) {
      const category = categories[i % categories.length]!;
      const status = (["Open", "InProgress", "Resolved"] as const)[i % 3]!;
      const createdAt = daysAgo(2 + i);

      const complaint = await prisma.complaint.create({
        data: {
          societyId: society.id,
          residentId: resident.id,
          category,
          description: `${category} issue reported near flat ${resident.flatNumber}.`,
          priority: (["Low", "Medium", "High"] as const)[i % 3]!,
          currentStatus: status,
          createdAt,
        },
      });

      const historyStatuses: Array<"Open" | "InProgress" | "Resolved"> =
        status === "Open" ? ["Open"] : status === "InProgress" ? ["Open", "InProgress"] : ["Open", "InProgress", "Resolved"];

      for (const [j, historyStatus] of historyStatuses.entries()) {
        await prisma.complaintStatusHistory.create({
          data: {
            complaintId: complaint.id,
            societyId: society.id,
            status: historyStatus,
            actorId: j === 0 ? resident.id : admin.id,
            timestamp: new Date(createdAt.getTime() + j * 60 * 60 * 1000),
          },
        });
      }
    }

    await prisma.notice.createMany({
      data: [
        {
          societyId: society.id,
          title: "Water supply maintenance this weekend",
          body: "Water will be shut off from 10am-2pm on Saturday for tank cleaning.",
          isImportant: true,
          postedBy: admin.id,
        },
        {
          societyId: society.id,
          title: "Annual society meeting",
          body: "The AGM will be held in the clubhouse next month. Agenda to follow.",
          isImportant: false,
          postedBy: admin.id,
        },
      ],
    });

    console.log(`✓ ${def.name}`);
    console.log(`  invite code: ${def.inviteCode}`);
    console.log(`  admin: ${admin.email}`);
    console.log(`  residents: ${residents.map((r) => r.email).join(", ")}\n`);
  }

  console.log(`All seeded accounts use the password: ${DEMO_PASSWORD}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
