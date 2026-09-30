import { index, integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const sectionEnum = pgEnum("section", ["editorial", "commercial"]);

export const stories = pgTable(
  "stories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    section: sectionEnum("section").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("stories_section_order_idx").on(t.section, t.sortOrder)],
);

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
    // Set when the photo is starred for the homepage, which lists starred photos in this order.
    featuredAt: timestamp("featured_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("photos_story_order_idx").on(t.storyId, t.sortOrder),
    index("photos_featured_idx").on(t.featuredAt),
  ],
);
