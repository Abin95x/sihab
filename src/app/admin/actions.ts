"use server";

import { randomUUID } from "node:crypto";
import { and, eq, inArray, sql, type AnyColumn } from "drizzle-orm";
import { revalidatePath, updateTag } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSession, destroySession, isAdminConfigured, requireAdmin } from "@/lib/auth";
import { CONTENT_TAG } from "@/lib/data";
import { getDb, isDbConfigured } from "@/lib/db";
import { admins, photos, stories } from "@/lib/db/schema";
import { processImage } from "@/lib/images";
import { isSection, isUuid, type Section } from "@/lib/photos";
import { clientIp } from "@/lib/memory-rate-limit";
import { burnPasswordCheck, verifyPassword } from "@/lib/password";
import { consume, reset } from "@/lib/rate-limit";
import { deletePhotoFiles, isStorageConfigured, putPhotoFiles } from "@/lib/storage";
import { isBoolean, normalizeUsername, PASSWORD_MAX, readText } from "@/lib/validation";

export type ActionResult = { ok?: boolean; error?: string; id?: string };

const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
const MAX_TITLE = 200;
const MAX_DESCRIPTION = 5000;
const MAX_REORDER = 1000;

// The homepage is included because any photo may be starred to appear there.
function revalidateSection(section: Section) {
  updateTag(CONTENT_TAG);
  revalidatePath("/");
  revalidatePath(`/${section}`);
  revalidatePath("/admin");
}

/** Validates a list of ids sent from a drag-and-drop reorder. */
function readOrder(ids: unknown): string[] | null {
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > MAX_REORDER) return null;
  if (!ids.every(isUuid) || new Set(ids).size !== ids.length) return null;
  return ids;
}

/** SQL giving each id its index in `ids`, for setting sort_order in one statement. */
function positionIn(column: AnyColumn, ids: string[]) {
  const cases = ids.map((id, i) => sql`when ${column} = ${id} then ${sql.raw(String(i))}`);
  return sql`case ${sql.join(cases, sql` `)} end`;
}

const DB_MISSING: ActionResult = { error: "Database is not configured. Set DATABASE_URL and restart the server." };
const STORAGE_MISSING: ActionResult = {
  error: "Photo storage is not configured. Set the S3_* and NEXT_PUBLIC_PHOTOS_URL variables and restart the server.",
};

// ---------- Auth ----------

// Failed-guess budgets. Per IP to stop one client guessing; per username to stop a spread-out attack
// on the one account. The username limit is looser so an attacker can't easily lock the admin out.
const LOGIN_LIMIT_PER_IP = { limit: 10, windowSeconds: 15 * 60 };
const LOGIN_LIMIT_PER_USER = { limit: 30, windowSeconds: 60 * 60 };
const LOGIN_FAILED: ActionResult = { error: "Incorrect username or password." };

export async function login(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  if (!isAdminConfigured()) {
    return { error: "Admin login is not configured. Set DATABASE_URL and AUTH_SECRET (32+ characters)." };
  }

  const username = normalizeUsername(formData.get("username"));
  const password = formData.get("password");
  if (!username || typeof password !== "string" || !password || password.length > PASSWORD_MAX) {
    return LOGIN_FAILED;
  }

  const ipKey = `login:ip:${clientIp(await headers())}`;
  const userKey = `login:user:${username}`;
  let limits: Awaited<ReturnType<typeof consume>>[];
  try {
    limits = await Promise.all([consume(ipKey, LOGIN_LIMIT_PER_IP), consume(userKey, LOGIN_LIMIT_PER_USER)]);
  } catch (error) {
    console.error("[sihab] Login rate limit check failed", error);
    return { error: "Sign-in is unavailable right now. Check the database connection and that `npm run db:push` has run." };
  }
  const blocked = limits.find((l) => !l.allowed);
  if (blocked) {
    const minutes = Math.ceil(blocked.retryAfterSeconds / 60);
    return { error: `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.` };
  }

  const db = getDb();
  const [admin] = await db
    .select({ id: admins.id, passwordHash: admins.passwordHash })
    .from(admins)
    .where(eq(admins.username, username))
    .limit(1);
  if (!admin) {
    await burnPasswordCheck(password);
    return LOGIN_FAILED;
  }
  if (!(await verifyPassword(password, admin.passwordHash))) return LOGIN_FAILED;

  // A successful sign-in clears this IP's budget; the per-username budget runs out on its own.
  await Promise.all([
    reset(ipKey),
    db.update(admins).set({ lastLoginAt: new Date() }).where(eq(admins.id, admin.id)),
  ]);
  await createSession(admin);
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
  // The name is only echoed back in messages; bound it so a crafted one can't bloat the response.
  const name = readText(file.name, 120) || "This file";
  if (file.size > MAX_UPLOAD_BYTES) return { error: `${name} is larger than 12 MB.` };

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
    return { error: `${name} could not be read. Use JPEG, PNG, WebP or AVIF.` };
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
    return { error: `${name} could not be saved to storage. Try again.` };
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
  if (!isBoolean(featured)) return { error: "Invalid request." };

  const [updated] = await getDb()
    .update(photos)
    .set({ featuredAt: featured ? new Date() : null })
    .where(eq(photos.id, id))
    .returning({ section: photos.section });
  if (!updated) return { error: "That photo no longer exists." };

  revalidateSection(updated.section);
  return { ok: true };
}

/** Archives or restores a photo. Archived photos are hidden from the public site. */
export async function setPhotoArchived(id: string, archived: boolean): Promise<ActionResult> {
  await requireAdmin();
  if (!isDbConfigured()) return DB_MISSING;
  if (!isUuid(id)) return { error: "Unknown photo." };
  if (!isBoolean(archived)) return { error: "Invalid request." };

  const [updated] = await getDb()
    .update(photos)
    .set({ archivedAt: archived ? new Date() : null })
    .where(eq(photos.id, id))
    .returning({ section: photos.section });
  if (!updated) return { error: "That photo no longer exists." };

  revalidateSection(updated.section);
  return { ok: true };
}

/** Saves the order of a story's photos after a drag-and-drop. `ids` is the full new order. */
export async function reorderPhotos(storyId: string, ids: string[]): Promise<ActionResult> {
  await requireAdmin();
  if (!isDbConfigured()) return DB_MISSING;
  const order = readOrder(ids);
  if (!isUuid(storyId) || !order) return { error: "Could not save the new order. Reload and try again." };

  const updated = await getDb()
    .update(photos)
    .set({ sortOrder: positionIn(photos.id, order) })
    .where(and(eq(photos.storyId, storyId), inArray(photos.id, order)))
    .returning({ section: photos.section });
  if (updated.length === 0) return { error: "Those photos no longer exist." };

  revalidateSection(updated[0].section);
  return { ok: true };
}

// ---------- Stories (editorial / commercial) ----------

function readStoryFields(formData: FormData) {
  const title = readText(formData.get("title") ?? "", MAX_TITLE);
  const description = readText(formData.get("description") ?? "", MAX_DESCRIPTION, { multiline: true });
  if (title === null) return { error: `Title must be under ${MAX_TITLE} characters.` } as const;
  if (!title) return { error: "Title is required." } as const;
  if (description === null) return { error: `Description must be under ${MAX_DESCRIPTION} characters.` } as const;
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

/** Archives or restores a story. Archived stories, and all their photos, are hidden from the public site. */
export async function setStoryArchived(id: string, archived: boolean): Promise<ActionResult> {
  await requireAdmin();
  if (!isDbConfigured()) return DB_MISSING;
  if (!isUuid(id)) return { error: "Unknown story." };
  if (!isBoolean(archived)) return { error: "Invalid request." };

  const [updated] = await getDb()
    .update(stories)
    .set({ archivedAt: archived ? new Date() : null })
    .where(eq(stories.id, id))
    .returning({ section: stories.section });
  if (!updated) return { error: "That story no longer exists." };

  revalidateSection(updated.section);
  return { ok: true };
}

/** Saves the order of a section's stories after a drag-and-drop. `ids` is the new order of the dragged group. */
export async function reorderStories(section: Section, ids: string[]): Promise<ActionResult> {
  await requireAdmin();
  if (!isDbConfigured()) return DB_MISSING;
  const order = readOrder(ids);
  if (!isSection(section) || !order) return { error: "Could not save the new order. Reload and try again." };

  await getDb()
    .update(stories)
    .set({ sortOrder: positionIn(stories.id, order) })
    .where(and(eq(stories.section, section), inArray(stories.id, order)));

  revalidateSection(section);
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
