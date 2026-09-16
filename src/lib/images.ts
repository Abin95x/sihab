import "server-only";
import sharp from "sharp";
import { FULL_MAX_EDGE, THUMB_MAX_EDGE } from "./photos";

/**
 * Normalises an uploaded image: applies EXIF orientation, strips metadata (including GPS),
 * and produces a full-size and a thumbnail WebP.
 */
export async function processImage(input: Buffer) {
  const base = sharp(input, { failOn: "error" }).rotate();

  const full = await base
    .clone()
    .resize({ width: FULL_MAX_EDGE, height: FULL_MAX_EDGE, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });

  const thumb = await base
    .clone()
    .resize({ width: THUMB_MAX_EDGE, height: THUMB_MAX_EDGE, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 78 })
    .toBuffer();

  return {
    data: full.data,
    thumb,
    width: full.info.width,
    height: full.info.height,
    mime: "image/webp",
  };
}
