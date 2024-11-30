import {
  boolean,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { sql } from "drizzle-orm";

export const profiles = pgTable("profiles", {
  id: uuid("id")
    .primaryKey()
    .references(() => auth.users.id),
  email: text("email").notNull(),
  fullName: text("full_name"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  lastCheckIn: timestamp("last_check_in", { withTimezone: true }),
  isSubscribed: boolean("is_subscribed").default(false),
  stripeCustomerId: text("stripe_customer_id"),
});

export const secrets = pgTable("secrets", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => profiles.id),
  title: text("title").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  checkInInterval: interval("check_in_interval").notNull(),
  lastCheckIn: timestamp("last_check_in", { withTimezone: true }),
  isActive: boolean("is_active").default(true),
});

export const contacts = pgTable("contacts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => profiles.id),
  email: text("email").notNull(),
  fullName: text("full_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

export const secretContacts = pgTable(
  "secret_contacts",
  {
    secretId: uuid("secret_id")
      .notNull()
      .references(() => secrets.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
  },
  (table) => ({
    pk: primaryKey(table.secretId, table.contactId),
  }),
);

// Relations
export const profilesRelations = relations(profiles, ({ many }) => ({
  secrets: many(secrets),
  contacts: many(contacts),
}));

export const secretsRelations = relations(secrets, ({ one, many }) => ({
  profile: one(profiles, {
    fields: [secrets.userId],
    references: [profiles.id],
  }),
  secretContacts: many(secretContacts),
}));

export const contactsRelations = relations(contacts, ({ one, many }) => ({
  profile: one(profiles, {
    fields: [contacts.userId],
    references: [profiles.id],
  }),
  secretContacts: many(secretContacts),
}));

export const secretContactsRelations = relations(secretContacts, ({ one }) => ({
  secret: one(secrets, {
    fields: [secretContacts.secretId],
    references: [secrets.id],
  }),
  contact: one(contacts, {
    fields: [secretContacts.contactId],
    references: [contacts.id],
  }),
}));
