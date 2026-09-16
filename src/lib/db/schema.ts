import { customType, index, integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

export const sectionEnum = pgEnum("section", ["home", "editorial", "commercial"]);

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

export const photos = pgTable(
  "photos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    section: sectionEnum("section").notNull(),
    // Homepage photos have no story; editorial and commercial photos always belong to one.
    storyId: uuid("story_id").references(() => stories.id, { onDelete: "cascade" }),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    mime: text("mime").notNull(),
    data: bytea("data").notNull(),
    thumb: bytea("thumb").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("photos_section_order_idx").on(t.section, t.sortOrder),
    index("photos_story_order_idx").on(t.storyId, t.sortOrder),
  ],
);
