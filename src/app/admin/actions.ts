"use server";

import { and, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { checkCredentials, createSession, destroySession, isAdminConfigured, requireAdmin } from "@/lib/auth";
import { getDb, isDbConfigured } from "@/lib/db";
import { photos, stories } from "@/lib/db/schema";
import { processImage } from "@/lib/images";
import { isSection, isStorySection, isUuid, type Section } from "@/lib/photos";
import { clearFailures, isRateLimited, recordFailure } from "@/lib/rate-limit";

export type ActionResult = { ok?: boolean; error?: string };

const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
const MAX_TITLE = 200;
const MAX_DESCRIPTION = 5000;

function revalidateSection(section: Section) {
  revalidatePath(section === "home" ? "/" : `/${section}`);
  revalidatePath("/admin");
}

const DB_MISSING: ActionResult = { error: "Database is not configured. Set DATABASE_URL and restart the server." };

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

  const section = formData.get("section");
  if (!isSection(section)) return { error: "Unknown section." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "No file received." };
  if (file.size > MAX_UPLOAD_BYTES) return { error: `${file.name} is larger than 12 MB.` };

  const db = getDb();
  let storyId: string | null = null;
  if (section !== "home") {
    const requested = formData.get("storyId");
    if (!isUuid(requested)) return { error: "Choose a story for this photo." };
    const [story] = await db
      .select({ id: stories.id })
      .from(stories)
      .where(and(eq(stories.id, requested), eq(stories.section, section)))
      .limit(1);
    if (!story) return { error: "That story no longer exists." };
    storyId = story.id;
  }

  let image: Awaited<ReturnType<typeof processImage>>;
  try {
    image = await processImage(Buffer.from(await file.arrayBuffer()));
  } catch {
    return { error: `${file.name} could not be read. Use JPEG, PNG, WebP or AVIF.` };
  }

  const scope = storyId
    ? eq(photos.storyId, storyId)
    : and(eq(photos.section, "home"), isNull(photos.storyId));
  const [{ next }] = await db
    .select({ next: sql<number>`coalesce(max(${photos.sortOrder}), -1) + 1` })
    .from(photos)
    .where(scope);

  await db.insert(photos).values({ section, storyId, ...image, sortOrder: Number(next) });
  revalidateSection(section);
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

  revalidateSection(deleted.section);
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
  if (!isStorySection(section)) return { error: "Unknown section." };
  const fields = readStoryFields(formData);
  if ("error" in fields) return fields;

  const db = getDb();
  // New stories go to the top of the page.
  const [{ first }] = await db
    .select({ first: sql<number>`coalesce(min(${stories.sortOrder}), 1) - 1` })
    .from(stories)
    .where(eq(stories.section, section));

  await db.insert(stories).values({ section, ...fields, sortOrder: Number(first) });
  revalidateSection(section);
  return { ok: true };
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

  // Photos in the story are removed by the foreign key's ON DELETE CASCADE.
  const [deleted] = await getDb()
    .delete(stories)
    .where(eq(stories.id, id))
    .returning({ section: stories.section });
  if (!deleted) return { error: "That story was already removed." };

  revalidateSection(deleted.section);
  return { ok: true };
}
