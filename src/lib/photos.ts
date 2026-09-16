// Shared by server and client: photo types, sections and URL helpers.

export const SECTIONS = ["home", "editorial", "commercial"] as const;
export type Section = (typeof SECTIONS)[number];
export type StorySection = Exclude<Section, "home">;

export type PhotoMeta = {
  id: string;
  width: number;
  height: number;
  /** Static image URL for demo photos; database photos are served from the photo API. */
  src?: string;
};

export type StoryWithPhotos = {
  id: string;
  title: string;
  description: string;
  photos: PhotoMeta[];
};

/** Longest edge, in pixels, of the stored full-size image. */
export const FULL_MAX_EDGE = 2400;
/** Longest edge, in pixels, of the stored thumbnail used in grids. */
export const THUMB_MAX_EDGE = 1200;

export function isSection(value: unknown): value is Section {
  return typeof value === "string" && (SECTIONS as readonly string[]).includes(value);
}

export function isStorySection(value: unknown): value is StorySection {
  return value === "editorial" || value === "commercial";
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

export function photoUrl(photo: PhotoMeta, size: "thumb" | "full") {
  return photo.src ?? `/api/photos/${photo.id}/${size}`;
}

export function photoSrcSet(photo: PhotoMeta) {
  if (photo.src) return undefined;
  const scale = Math.min(1, THUMB_MAX_EDGE / Math.max(photo.width, photo.height));
  const thumbWidth = Math.round(photo.width * scale);
  if (thumbWidth >= photo.width) return undefined;
  return `${photoUrl(photo, "thumb")} ${thumbWidth}w, ${photoUrl(photo, "full")} ${photo.width}w`;
}

export function pad2(n: number) {
  return String(n).padStart(2, "0");
}
