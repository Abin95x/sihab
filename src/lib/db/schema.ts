import { index, integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// Row-level security is enabled on every table with no policies. Supabase exposes the public schema through
// its Data API; this makes those tables unreadable there. The app connects as the tables' owner, which
// bypasses RLS, so its own queries are unaffected.

export const sectionEnum = pgEnum("section", ["editorial", "commercial"]);

export const stories = pgTable(
  "stories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    section: sectionEnum("section").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    sortOrder: integer("sort_order").notNull().default(0),
    // Archived stories stay in the admin but are hidden from the public site.
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("stories_section_order_idx").on(t.section, t.sortOrder)],
).enableRLS();

// The image files are stored in the bucket under photoKey(id, "full" | "thumb"), not in the database.
export const photos = pgTable(
  "photos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    section: sectionEnum("section").notNull(),
    storyId: uuid("story_id")
      .notNull()
      .references(() => stories.id, { onDelete: "cascade" }),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    // Set when the photo is starred for the homepage, which lists starred photos in this order. Reordering
    // the homepage in the admin restamps it.
    featuredAt: timestamp("featured_at", { withTimezone: true }),
    // Archived photos stay in the admin but are hidden from the public site, including the homepage.
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("photos_story_order_idx").on(t.storyId, t.sortOrder),
    index("photos_featured_idx").on(t.featuredAt),
  ],
).enableRLS();

// Admin accounts. Create or reset one with `npm run admin:create -- <username>`.
export const admins = pgTable("admins", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Stored lowercase; see normalizeUsername() in src/lib/validation.ts.
  username: text("username").notNull().unique(),
  // scrypt hash in the format written by hashPassword() in src/lib/password.ts.
  passwordHash: text("password_hash").notNull(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();

// Fixed-window counters for rate limiting, shared by every server instance. See src/lib/rate-limit.ts.
export const rateLimits = pgTable(
  "rate_limits",
  {
    key: text("key").primaryKey(),
    count: integer("count").notNull(),
    resetAt: timestamp("reset_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("rate_limits_reset_idx").on(t.resetAt)],
).enableRLS();
