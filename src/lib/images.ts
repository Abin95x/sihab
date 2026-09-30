import "server-only";
import sharp from "sharp";
import { FULL_MAX_EDGE, THUMB_MAX_EDGE } from "./photos";

// sharp reports AVIF as "heif". Anything else (SVG, GIF, TIFF, raw formats…) is refused before decoding.
const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp", "heif"]);
// Rejects decompression bombs: a small file that expands to a huge bitmap. 200 MP is above medium-format sensors.
const MAX_INPUT_PIXELS = 200_000_000;

/**
 * Normalises an uploaded image: applies EXIF orientation, strips metadata (including GPS),
 * and produces a full-size and a thumbnail WebP.
 */
export async function processImage(input: Buffer) {
  const { format } = await sharp(input).metadata();
  if (!format || !ALLOWED_FORMATS.has(format)) throw new Error(`Unsupported format: ${format}`);

  const base = sharp(input, { failOn: "error", limitInputPixels: MAX_INPUT_PIXELS }).rotate();

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
