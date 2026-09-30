// Input clean-up shared by Server Actions. React escapes everything it renders, so these exist to keep
// stored data tidy and bounded, not to strip HTML.

// C0/C1 control characters, plus zero-width and bidi-override characters that can disguise text.
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F​-‏‪-‮⁦-⁩﻿]/g;

/**
 * Reads a form field as plain text: Unicode-normalised, control characters removed, trimmed.
 * Newlines are kept only when `multiline` is set. Returns null when the field is not a string
 * or is longer than `max` characters.
 */
export function readText(value: unknown, max: number, { multiline = false } = {}): string | null {
  if (typeof value !== "string") return null;
  let text = value.normalize("NFC").replace(/\r\n?/g, "\n").replace(CONTROL_CHARS, "");
  text = multiline ? text.replace(/\t/g, " ").replace(/\n{3,}/g, "\n\n") : text.replace(/\s+/g, " ");
  text = text.trim();
  return text.length > max ? null : text;
}

const USERNAME_RE = /^[a-z0-9._-]{3,64}$/;
export const PASSWORD_MAX = 256;

/** Usernames are case-insensitive and stored lowercase. Keep in sync with scripts/create-admin.mjs. */
export function normalizeUsername(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const username = value.normalize("NFKC").trim().toLowerCase();
  return USERNAME_RE.test(username) ? username : null;
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

export const SEARCH_MAX = 100;

/** A search query from the URL (`?q=`): plain text, at most SEARCH_MAX characters, "" when absent. */
export function readSearch(value: unknown): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string") return "";
  return readText(raw.slice(0, SEARCH_MAX * 2), Infinity)?.slice(0, SEARCH_MAX).trim() ?? "";
}

/** Error messages keyed by form field name, shown under each input. */
export type FieldErrors = Partial<Record<string, string>>;

export const TITLE_MAX = 200;
export const DESCRIPTION_MAX = 5000;

/**
 * Validates a story's title and description. Runs in the browser before submitting (so mistakes show
 * instantly) and again in the Server Action (which is what actually protects the data).
 */
export function readStoryFields(
  formData: FormData,
): { title: string; description: string; fieldErrors?: undefined } | { fieldErrors: FieldErrors } {
  const title = readText(formData.get("title") ?? "", TITLE_MAX);
  const description = readText(formData.get("description") ?? "", DESCRIPTION_MAX, { multiline: true });
  const fieldErrors: FieldErrors = {};
  if (title === null) fieldErrors.title = `Keep the title under ${TITLE_MAX} characters.`;
  else if (!title) fieldErrors.title = "Title is required.";
  if (description === null) fieldErrors.description = `Keep the description under ${DESCRIPTION_MAX} characters.`;
  if (title === null || !title || description === null) return { fieldErrors };
  return { title, description };
}

/** Empty-field checks for the sign-in form. Wrong credentials are reported separately, for both fields at once. */
export function loginFieldErrors(formData: FormData): FieldErrors | null {
  const fieldErrors: FieldErrors = {};
  if (!String(formData.get("username") ?? "").trim()) fieldErrors.username = "Enter your username.";
  if (!formData.get("password")) fieldErrors.password = "Enter your password.";
  return Object.keys(fieldErrors).length > 0 ? fieldErrors : null;
}
