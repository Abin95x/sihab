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

export const USERNAME_RE = /^[a-z0-9._-]{3,64}$/;
export const PASSWORD_MIN = 12;
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
