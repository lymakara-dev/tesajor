import {
  pgTable,
  pgEnum,
  text,
  timestamp,
  integer,
  boolean,
  doublePrecision,
  date,
  jsonb,
  uuid,
  primaryKey,
  unique,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

export const splitMethodEnum = pgEnum("split_method", [
  "equal",
  "exact",
  "percent",
  "shares",
  "itemized",
]);

export const groupRoleEnum = pgEnum("group_role", ["owner", "member"]);

// --- Core users ---

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  passwordHash: text("password_hash"),
  image: text("avatar_url"),
  defaultCurrency: text("default_currency").notNull().default("USD"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// --- Auth.js adapter tables ---

export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  ],
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })],
);

// --- Groups ---

export const groups = pgTable("groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  baseCurrency: text("base_currency").notNull().default("USD"),
  inviteCode: text("invite_code").notNull().unique(),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const groupMembers = pgTable("group_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupId: uuid("group_id")
    .notNull()
    .references(() => groups.id, { onDelete: "cascade" }),
  // Nullable: placeholder members have no account yet.
  userId: uuid("user_id").references(() => users.id),
  displayName: text("display_name").notNull(),
  role: groupRoleEnum("role").notNull().default("member"),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
});

// --- Expenses ---

export const expenses = pgTable("expenses", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupId: uuid("group_id")
    .notNull()
    .references(() => groups.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  totalAmountCents: integer("total_amount_cents").notNull(),
  currency: text("currency").notNull(),
  exchangeRate: text("exchange_rate"), // stored as decimal string; applied at read time
  category: text("category"),
  note: text("note"),
  receiptUrl: text("receipt_url"),
  expenseDate: timestamp("expense_date", { mode: "date" }).notNull(),
  splitMethod: splitMethodEnum("split_method").notNull(),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  deletedAt: timestamp("deleted_at"),
});

export const expensePayers = pgTable("expense_payers", {
  id: uuid("id").primaryKey().defaultRandom(),
  expenseId: uuid("expense_id")
    .notNull()
    .references(() => expenses.id, { onDelete: "cascade" }),
  memberId: uuid("member_id")
    .notNull()
    .references(() => groupMembers.id),
  paidAmountCents: integer("paid_amount_cents").notNull(),
});

export const expenseShares = pgTable("expense_shares", {
  id: uuid("id").primaryKey().defaultRandom(),
  expenseId: uuid("expense_id")
    .notNull()
    .references(() => expenses.id, { onDelete: "cascade" }),
  memberId: uuid("member_id")
    .notNull()
    .references(() => groupMembers.id),
  owedAmountCents: integer("owed_amount_cents").notNull(),
  // percent, share count, or item refs depending on split_method
  shareMeta: jsonb("share_meta"),
});

export const expenseItems = pgTable("expense_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  expenseId: uuid("expense_id")
    .notNull()
    .references(() => expenses.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  priceCents: integer("price_cents").notNull(),
});

export const itemAssignees = pgTable(
  "item_assignees",
  {
    itemId: uuid("item_id")
      .notNull()
      .references(() => expenseItems.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => groupMembers.id),
  },
  (t) => [primaryKey({ columns: [t.itemId, t.memberId] })],
);

// --- Settlements & activity ---

export const settlements = pgTable("settlements", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupId: uuid("group_id")
    .notNull()
    .references(() => groups.id, { onDelete: "cascade" }),
  fromMember: uuid("from_member")
    .notNull()
    .references(() => groupMembers.id),
  toMember: uuid("to_member")
    .notNull()
    .references(() => groupMembers.id),
  amountCents: integer("amount_cents").notNull(),
  method: text("method"),
  note: text("note"),
  settledAt: timestamp("settled_at").notNull().defaultNow(),
});

export const activityLog = pgTable("activity_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupId: uuid("group_id")
    .notNull()
    .references(() => groups.id, { onDelete: "cascade" }),
  actor: uuid("actor").references(() => users.id),
  action: text("action").notNull(),
  payloadJson: jsonb("payload_json"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// --- Telegram integration ---

export const paymentRequestStatusEnum = pgEnum("payment_request_status", [
  "sent",
  "delivered",
  "failed",
  "paid",
]);

export const telegramAccounts = pgTable("telegram_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  telegramUserId: text("telegram_user_id").notNull().unique(),
  chatId: text("chat_id"),
  username: text("username"),
  linkedAt: timestamp("linked_at").notNull().defaultNow(),
});

// One-time tokens for the t.me/<bot>?start=<token> deep-link linking flow;
// short-lived, deleted once consumed by the webhook.
export const telegramLinkTokens = pgTable("telegram_link_tokens", {
  token: text("token").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at").notNull(),
});

export const paymentMethods = pgTable("payment_methods", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  qrImageUrl: text("qr_image_url"),
  paymentLink: text("payment_link"),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const paymentRequests = pgTable("payment_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupId: uuid("group_id")
    .notNull()
    .references(() => groups.id, { onDelete: "cascade" }),
  requesterMember: uuid("requester_member")
    .notNull()
    .references(() => groupMembers.id),
  debtorMember: uuid("debtor_member")
    .notNull()
    .references(() => groupMembers.id),
  amountCents: integer("amount_cents").notNull(),
  paymentMethodId: uuid("payment_method_id").references(() => paymentMethods.id),
  status: paymentRequestStatusEnum("status").notNull().default("sent"),
  telegramMessageId: text("telegram_message_id"),
  sentAt: timestamp("sent_at").notNull().defaultNow(),
  paidAt: timestamp("paid_at"),
  // Set once the requester confirms the debtor's "I've paid" claim and a
  // real settlement is recorded — the claim alone never affects balances.
  confirmedAt: timestamp("confirmed_at"),
  settlementId: uuid("settlement_id").references(() => settlements.id),
});

// --- Trip Agenda ---

export const tripVisibilityEnum = pgEnum("trip_visibility", [
  "private",
  "link",
  "public_template",
]);

export const tripRoleEnum = pgEnum("trip_role", ["owner", "editor", "viewer"]);

export const agendaItemCategoryEnum = pgEnum("agenda_item_category", [
  "food",
  "sight",
  "transport",
  "hotel",
  "activity",
  "other",
]);

export const agendaItemStatusEnum = pgEnum("agenda_item_status", [
  "todo",
  "done",
  "skipped",
]);

export const trips = pgTable("trips", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Nullable: a trip doesn't have to be linked to an expense-splitting group.
  groupId: uuid("group_id").references(() => groups.id, { onDelete: "set null" }),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id),
  title: text("title").notNull(),
  description: text("description"),
  coverUrl: text("cover_url"),
  startDate: date("start_date", { mode: "date" }).notNull(),
  endDate: date("end_date", { mode: "date" }).notNull(),
  baseCurrency: text("base_currency").notNull().default("USD"),
  visibility: tripVisibilityEnum("visibility").notNull().default("private"),
  // Lets other users join as a collaborator (see trip_members) — distinct
  // from `visibility`, which controls template cloning.
  inviteCode: text("invite_code").notNull().unique(),
  clonedFromTripId: uuid("cloned_from_trip_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const tripMembers = pgTable(
  "trip_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: tripRoleEnum("role").notNull().default("viewer"),
    joinedAt: timestamp("joined_at").notNull().defaultNow(),
  },
  (t) => [unique().on(t.tripId, t.userId)],
);

export const agendaItems = pgTable("agenda_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  tripId: uuid("trip_id")
    .notNull()
    .references(() => trips.id, { onDelete: "cascade" }),
  dayNumber: integer("day_number").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  title: text("title").notNull(),
  category: agendaItemCategoryEnum("category").notNull().default("other"),
  plannedStart: timestamp("planned_start"),
  plannedEnd: timestamp("planned_end"),
  plannedCostCents: integer("planned_cost_cents"),
  currency: text("currency").notNull().default("USD"),
  placeName: text("place_name"),
  placeId: text("place_id"),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  address: text("address"),
  status: agendaItemStatusEnum("status").notNull().default("todo"),
  completedAt: timestamp("completed_at"),
  completedBy: uuid("completed_by").references(() => users.id),
});

export const itemNotes = pgTable("item_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  agendaItemId: uuid("agenda_item_id")
    .notNull()
    .references(() => agendaItems.id, { onDelete: "cascade" }),
  authorId: uuid("author_id")
    .notNull()
    .references(() => users.id),
  mood: integer("mood"), // 1-5
  noteText: text("note_text"),
  tags: text("tags").array(),
  actualCostCents: integer("actual_cost_cents"),
  photoUrls: text("photo_urls").array(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const achievements = pgTable(
  "achievements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    earnedAt: timestamp("earned_at").notNull().defaultNow(),
  },
  (t) => [unique().on(t.userId, t.key)],
);
