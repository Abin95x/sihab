import "server-only";
import { and, asc, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { unstable_cache } from "next/cache";
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

/** How many items the public pages load at a time as the visitor scrolls. */
export const HOME_PAGE_SIZE = 12;
export const STORIES_PAGE_SIZE = 3;

/** One slice of a list. `nextOffset` is where the following slice starts, or null at the end. */
export type Page<T> = { items: T[]; nextOffset: number | null };

type Range = { offset?: number; limit?: number };

/** Turns rows fetched with `limit + 1` into a page: the extra row only signals that more exist. */
function toPage<T>(rows: T[], offset: number, limit: number): Page<T> {
  return { items: rows.slice(0, limit), nextOffset: rows.length > limit ? offset + limit : null };
}

/**
 * Starred photos, in the order they were starred. Archived photos and photos in archived stories are left out.
 * Pass `limit` to fetch one slice; without it every starred photo is returned (admin only).
 */
export async function queryHomePhotos({ offset = 0, limit }: Range = {}): Promise<PhotoMeta[]> {
  const query = getDb()
    .select(photoMeta)
    .from(photos)
    .innerJoin(stories, eq(photos.storyId, stories.id))
    .where(and(isNotNull(photos.featuredAt), isNull(photos.archivedAt), isNull(stories.archivedAt)))
    .orderBy(asc(photos.featuredAt), asc(photos.id));
  return limit === undefined ? query : query.limit(limit).offset(offset);
}

/**
 * Stories in a section, with their photos. Archived stories and photos are left out unless `includeArchived`
 * is set (admin only). Pass `limit` to fetch one slice of stories; photos are only loaded for that slice.
 */
export async function queryStories(
  section: Section,
  { includeArchived = false, offset = 0, limit }: { includeArchived?: boolean } & Range = {},
): Promise<StoryWithPhotos[]> {
  const db = getDb();
  const storyQuery = db
    .select({
      id: stories.id,
      title: stories.title,
      description: stories.description,
      archived: sql<boolean>`${stories.archivedAt} is not null`,
    })
    .from(stories)
    .where(and(eq(stories.section, section), includeArchived ? undefined : isNull(stories.archivedAt)))
    .orderBy(asc(stories.sortOrder), desc(stories.createdAt), asc(stories.id));
  const storyRows = await (limit === undefined ? storyQuery : storyQuery.limit(limit).offset(offset));
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

/** Cache tag on the public queries below. Server Actions invalidate it after every change. */
export const CONTENT_TAG = "content";

// The public pages share one cached copy of each slice instead of querying Postgres on every visit; the
// arguments are part of the cache key. A day-long lifetime is a backstop only: every admin change
// invalidates CONTENT_TAG immediately. Each query fetches one extra row to learn whether more follow.
const CACHE = { tags: [CONTENT_TAG], revalidate: 86400 };
const cachedHomePhotos = unstable_cache(
  (offset: number) => queryHomePhotos({ offset, limit: HOME_PAGE_SIZE + 1 }),
  ["home-photos-page"],
  CACHE,
);
const cachedStories = unstable_cache(
  (section: Section, offset: number) => queryStories(section, { offset, limit: STORIES_PAGE_SIZE + 1 }),
  ["stories-page"],
  CACHE,
);

// Public pages render at request time (for the CSP nonce) from the cache above. Without DATABASE_URL
// they show the demo photos in public/demo; if a configured database fails they fall back to an empty state.

const EMPTY_PAGE: Page<never> = { items: [], nextOffset: null };

/** One slice of the homepage photos, starting at `offset`. */
export async function getHomePhotos(offset = 0): Promise<Page<PhotoMeta>> {
  await connection();
  if (!isDbConfigured()) return toPage(demoHomePhotos.slice(offset, offset + HOME_PAGE_SIZE + 1), offset, HOME_PAGE_SIZE);
  try {
    return toPage(await cachedHomePhotos(offset), offset, HOME_PAGE_SIZE);
  } catch (error) {
    console.error("[sihab] Failed to load homepage photos", error);
    return EMPTY_PAGE;
  }
}

/** One slice of a section's stories, starting at `offset`. */
export async function getStories(section: Section, offset = 0): Promise<Page<StoryWithPhotos>> {
  await connection();
  if (!isDbConfigured()) {
    return toPage(demoStories[section].slice(offset, offset + STORIES_PAGE_SIZE + 1), offset, STORIES_PAGE_SIZE);
  }
  try {
    return toPage(await cachedStories(section, offset), offset, STORIES_PAGE_SIZE);
  } catch (error) {
    console.error(`[sihab] Failed to load ${section} stories`, error);
    return EMPTY_PAGE;
  }
}
