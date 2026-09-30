import "server-only";
import { and, asc, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { connection } from "next/server";
import { getDb, isDbConfigured } from "./db";
import { demoHomePhotos, demoStories } from "./demo";
import { photos, stories } from "./db/schema";
import type { PhotoMeta, Section, StoryWithPhotos } from "./photos";

const photoMeta = {
  id: photos.id,
  width: photos.width,
  height: photos.height,
  featured: sql<boolean>`${photos.featuredAt} is not null`,
  archived: sql<boolean>`${photos.archivedAt} is not null`,
};

/** Starred photos, in the order they were starred. Archived photos and photos in archived stories are left out. */
export async function queryHomePhotos(): Promise<PhotoMeta[]> {
  return getDb()
    .select(photoMeta)
    .from(photos)
    .innerJoin(stories, eq(photos.storyId, stories.id))
    .where(and(isNotNull(photos.featuredAt), isNull(photos.archivedAt), isNull(stories.archivedAt)))
    .orderBy(asc(photos.featuredAt));
}

export type StoryOption = { id: string; title: string; section: Section };

/** Every story, for the story picker on the admin upload screen. */
export async function queryStoryOptions(): Promise<StoryOption[]> {
  return getDb()
    .select({ id: stories.id, title: stories.title, section: stories.section })
    .from(stories)
    .orderBy(asc(stories.sortOrder), desc(stories.createdAt));
}

/** Stories in a section. Archived stories and photos are left out unless `includeArchived` is set (admin only). */
export async function queryStories(
  section: Section,
  { includeArchived = false }: { includeArchived?: boolean } = {},
): Promise<StoryWithPhotos[]> {
  const db = getDb();
  const storyRows = await db
    .select({
      id: stories.id,
      title: stories.title,
      description: stories.description,
      archived: sql<boolean>`${stories.archivedAt} is not null`,
    })
    .from(stories)
    .where(and(eq(stories.section, section), includeArchived ? undefined : isNull(stories.archivedAt)))
    .orderBy(asc(stories.sortOrder), desc(stories.createdAt));
  if (storyRows.length === 0) return [];

  const photoRows = await db
    .select({ ...photoMeta, storyId: photos.storyId })
    .from(photos)
    .where(
      and(
        inArray(photos.storyId, storyRows.map((s) => s.id)),
        includeArchived ? undefined : isNull(photos.archivedAt),
      ),
    )
    .orderBy(asc(photos.sortOrder), asc(photos.createdAt));

  const byStory = new Map<string, PhotoMeta[]>(storyRows.map((s) => [s.id, []]));
  for (const { storyId, ...photo } of photoRows) {
    byStory.get(storyId)?.push(photo);
  }
  return storyRows.map((s) => ({ ...s, photos: byStory.get(s.id) ?? [] }));
}

// Public pages render at request time. Without DATABASE_URL they show the demo photos in public/demo;
// if a configured database fails they fall back to an empty state.

export async function getHomePhotos(): Promise<PhotoMeta[]> {
  await connection();
  if (!isDbConfigured()) return demoHomePhotos;
  try {
    return await queryHomePhotos();
  } catch (error) {
    console.error("[sihab] Failed to load homepage photos", error);
    return [];
  }
}

export async function getStories(section: Section): Promise<StoryWithPhotos[]> {
  await connection();
  if (!isDbConfigured()) return demoStories[section];
  try {
    return await queryStories(section);
  } catch (error) {
    console.error(`[sihab] Failed to load ${section} stories`, error);
    return [];
  }
}
