import "server-only";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { connection } from "next/server";
import { getDb, isDbConfigured } from "./db";
import { demoHomePhotos, demoStories } from "./demo";
import { photos, stories } from "./db/schema";
import type { PhotoMeta, StorySection, StoryWithPhotos } from "./photos";

const photoMeta = { id: photos.id, width: photos.width, height: photos.height };

export async function queryHomePhotos(): Promise<PhotoMeta[]> {
  return getDb()
    .select(photoMeta)
    .from(photos)
    .where(and(eq(photos.section, "home"), isNull(photos.storyId)))
    .orderBy(asc(photos.sortOrder), asc(photos.createdAt));
}

export async function queryStories(section: StorySection): Promise<StoryWithPhotos[]> {
  const db = getDb();
  const storyRows = await db
    .select({ id: stories.id, title: stories.title, description: stories.description })
    .from(stories)
    .where(eq(stories.section, section))
    .orderBy(asc(stories.sortOrder), desc(stories.createdAt));
  if (storyRows.length === 0) return [];

  const photoRows = await db
    .select({ ...photoMeta, storyId: photos.storyId })
    .from(photos)
    .where(inArray(photos.storyId, storyRows.map((s) => s.id)))
    .orderBy(asc(photos.sortOrder), asc(photos.createdAt));

  const byStory = new Map<string, PhotoMeta[]>(storyRows.map((s) => [s.id, []]));
  for (const { storyId, ...photo } of photoRows) {
    if (storyId) byStory.get(storyId)?.push(photo);
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

export async function getStories(section: StorySection): Promise<StoryWithPhotos[]> {
  await connection();
  if (!isDbConfigured()) return demoStories[section];
  try {
    return await queryStories(section);
  } catch (error) {
    console.error(`[sihab] Failed to load ${section} stories`, error);
    return [];
  }
}
