"use server";

import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { checkCredentials, createSession, destroySession, isAdminConfigured, requireAdmin } from "@/lib/auth";
import { getDb, isDbConfigured } from "@/lib/db";
import { photos, stories } from "@/lib/db/schema";
import { processImage } from "@/lib/images";
import { isSection, isUuid, type Section } from "@/lib/photos";
import { clearFailures, isRateLimited, recordFailure } from "@/lib/rate-limit";
import { deletePhotoFiles, isStorageConfigured, putPhotoFiles } from "@/lib/storage";

export type ActionResult = { ok?: boolean; error?: string; id?: string };

const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
const MAX_TITLE = 200;
const MAX_DESCRIPTION = 5000;

// The homepage is included because any photo may be starred to appear there.
function revalidateSection(section: Section) {
  revalidatePath("/");
  revalidatePath(`/${section}`);
  revalidatePath("/admin");
}

const DB_MISSING: ActionResult = { error: "Database is not configured. Set DATABASE_URL and restart the server." };
const STORAGE_MISSING: ActionResult = {
  error: "Photo storage is not configured. Set the S3_* and NEXT_PUBLIC_PHOTOS_URL variables and restart the server.",
};

// ---------- Auth ----------

export async function login(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  if (!isAdminConfigured()) {
    return { error: "Admin login is not configured. Set ADMIN_USERNAME, ADMIN_PASSWORD and AUTH_SECRET." };
  }
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (isRateLimited(ip)) {
    return { error: "Too many attempts. Try again in a few minutes." };
  }

  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!checkCredentials(username, password)) {
    recordFailure(ip);
    return { error: "Incorrect username or password." };
  }

  clearFailures(ip);
  await createSession(username);
  redirect("/admin");
}

export async function logout() {
  await destroySession();
  redirect("/admin/login");
}

// ---------- Photos ----------

export async function uploadPhoto(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  if (!isDbConfigured()) return DB_MISSING;
  if (!isStorageConfigured()) return STORAGE_MISSING;

  const storyId = formData.get("storyId");
  if (!isUuid(storyId)) return { error: "Choose a story for this photo." };
  const featured = formData.get("featured") === "on";

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "No file received." };
  if (file.size > MAX_UPLOAD_BYTES) return { error: `${file.name} is larger than 12 MB.` };

  const db = getDb();
  const [story] = await db
    .select({ id: stories.id, section: stories.section })
    .from(stories)
    .where(eq(stories.id, storyId))
    .limit(1);
  if (!story) return { error: "That story no longer exists." };

  let image: Awaited<ReturnType<typeof processImage>>;
  try {
    image = await processImage(Buffer.from(await file.arrayBuffer()));
  } catch {
    return { error: `${file.name} could not be read. Use JPEG, PNG, WebP or AVIF.` };
  }

  const [{ next }] = await db
    .select({ next: sql<number>`coalesce(max(${photos.sortOrder}), -1) + 1` })
    .from(photos)
    .where(eq(photos.storyId, story.id));

  // Files go up first so a photo row never points at missing files.
  const id = randomUUID();
  try {
    await putPhotoFiles(id, image);
  } catch (error) {
    console.error("[sihab] Failed to store photo files", error);
    return { error: `${file.name} could not be saved to storage. Try again.` };
  }

  try {
    await db.insert(photos).values({
      id,
      section: story.section,
      storyId: story.id,
      width: image.width,
      height: image.height,
      sortOrder: Number(next),
      featuredAt: featured ? new Date() : null,
    });
  } catch (error) {
    await deletePhotoFiles([id]);
    throw error;
  }
  revalidateSection(story.section);
  return { ok: true };
}

export async function deletePhoto(id: string): Promise<ActionResult> {
  await requireAdmin();
  if (!isDbConfigured()) return DB_MISSING;
  if (!isUuid(id)) return { error: "Unknown photo." };

  const [deleted] = await getDb()
    .delete(photos)
    .where(eq(photos.id, id))
    .returning({ section: photos.section });
  if (!deleted) return { error: "That photo was already removed." };

  await deletePhotoFiles([id]);
  revalidateSection(deleted.section);
  return { ok: true };
}

/** Stars or unstars a photo. Starred photos appear on the homepage. */
export async function setFeatured(id: string, featured: boolean): Promise<ActionResult> {
  await requireAdmin();
  if (!isDbConfigured()) return DB_MISSING;
  if (!isUuid(id)) return { error: "Unknown photo." };

  const [updated] = await getDb()
    .update(photos)
    .set({ featuredAt: featured ? new Date() : null })
    .where(eq(photos.id, id))
    .returning({ section: photos.section });
  if (!updated) return { error: "That photo no longer exists." };

  revalidateSection(updated.section);
  return { ok: true };
}

// ---------- Stories (editorial / commercial) ----------

function readStoryFields(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (!title) return { error: "Title is required." } as const;
  if (title.length > MAX_TITLE) return { error: `Title must be under ${MAX_TITLE} characters.` } as const;
  if (description.length > MAX_DESCRIPTION) {
    return { error: `Description must be under ${MAX_DESCRIPTION} characters.` } as const;
  }
  return { title, description } as const;
}

export async function createStory(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  if (!isDbConfigured()) return DB_MISSING;

  const section = formData.get("section");
  if (!isSection(section)) return { error: "Choose Editorial or Commercial." };
  const fields = readStoryFields(formData);
  if ("error" in fields) return fields;

  const db = getDb();
  // New stories go to the top of the page.
  const [{ first }] = await db
    .select({ first: sql<number>`coalesce(min(${stories.sortOrder}), 1) - 1` })
    .from(stories)
    .where(eq(stories.section, section));

  const [created] = await db
    .insert(stories)
    .values({ section, ...fields, sortOrder: Number(first) })
    .returning({ id: stories.id });
  revalidateSection(section);
  return { ok: true, id: created.id };
}

export async function updateStory(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  if (!isDbConfigured()) return DB_MISSING;

  const id = formData.get("id");
  if (!isUuid(id)) return { error: "Unknown story." };
  const fields = readStoryFields(formData);
  if ("error" in fields) return fields;

  const [updated] = await getDb()
    .update(stories)
    .set(fields)
    .where(eq(stories.id, id))
    .returning({ section: stories.section });
  if (!updated) return { error: "That story no longer exists." };

  revalidateSection(updated.section);
  return { ok: true };
}

export async function deleteStory(id: string): Promise<ActionResult> {
  await requireAdmin();
  if (!isDbConfigured()) return DB_MISSING;
  if (!isUuid(id)) return { error: "Unknown story." };

  // Photo rows in the story are removed by the foreign key's ON DELETE CASCADE; their files are removed here.
  const db = getDb();
  const storyPhotos = await db.select({ id: photos.id }).from(photos).where(eq(photos.storyId, id));
  const [deleted] = await db.delete(stories).where(eq(stories.id, id)).returning({ section: stories.section });
  if (!deleted) return { error: "That story was already removed." };

  await deletePhotoFiles(storyPhotos.map((p) => p.id));

  revalidateSection(deleted.section);
  return { ok: true };
}
