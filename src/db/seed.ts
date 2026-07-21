import "dotenv/config";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { db } from "./index";
import { users, groups, groupMembers, activityLog } from "./schema";

async function main() {
  const passwordHash = await bcrypt.hash("password123", 12);

  const demoUsers = [
    { name: "Anna Lee", email: "anna@example.com" },
    { name: "Ben Ortiz", email: "ben@example.com" },
    { name: "Cara Kim", email: "cara@example.com" },
    { name: "Dev Patel", email: "dev@example.com" },
  ];

  const insertedUsers = await db
    .insert(users)
    .values(demoUsers.map((u) => ({ ...u, passwordHash })))
    .returning();

  const [group] = await db
    .insert(groups)
    .values({
      name: "Friday Dinner Crew",
      baseCurrency: "USD",
      inviteCode: nanoid(10),
      createdBy: insertedUsers[0].id,
    })
    .returning();

  await db.insert(groupMembers).values(
    insertedUsers.map((u, i) => ({
      groupId: group.id,
      userId: u.id,
      displayName: u.name,
      role: i === 0 ? ("owner" as const) : ("member" as const),
    })),
  );

  await db.insert(activityLog).values({
    groupId: group.id,
    actor: insertedUsers[0].id,
    action: "group.created",
    payloadJson: { name: group.name, seeded: true },
  });

  console.log(`Seeded ${insertedUsers.length} users and group "${group.name}".`);
  console.log(`Invite code: ${group.inviteCode}`);
  console.log("Demo password for all users: password123");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
