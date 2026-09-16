// Shrinks large images in the browser before upload so requests stay well under
// hosting body-size limits (e.g. 4.5 MB on Vercel). The server re-encodes everything anyway.

const MAX_EDGE = 3000;
const PASS_THROUGH_BYTES = 3.5 * 1024 * 1024;
const PASS_THROUGH_TYPES = /^image\/(jpeg|png|webp|avif)$/;

export async function prepareForUpload(file: File): Promise<Blob> {
  if (file.size <= PASS_THROUGH_BYTES && PASS_THROUGH_TYPES.test(file.type)) return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    // The browser can't decode it (e.g. HEIC in Chrome); let the server try.
    return file;
  }

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file;
  }
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
  return blob ?? file;
}
