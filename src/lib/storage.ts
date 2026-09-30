import "server-only";
import { DeleteObjectsCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { photoKey } from "./photos";

// Photo files live in an S3-compatible bucket (Supabase Storage). The bucket is public, so
// pages link to the files directly (see photoUrl); the server only writes and deletes them.

const globalForStorage = globalThis as unknown as { sihabS3?: S3Client };

export function isStorageConfigured() {
  return Boolean(
    process.env.S3_ENDPOINT &&
      process.env.S3_ACCESS_KEY_ID &&
      process.env.S3_SECRET_ACCESS_KEY &&
      process.env.S3_BUCKET &&
      process.env.NEXT_PUBLIC_PHOTOS_URL,
  );
}

function getS3() {
  return (globalForStorage.sihabS3 ??= new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION || "us-east-1",
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
  }));
}

type StoredImage = { data: Buffer; thumb: Buffer; mime: string };

export async function putPhotoFiles(id: string, image: StoredImage) {
  const s3 = getS3();
  const put = (size: "thumb" | "full", body: Buffer) =>
    s3.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: photoKey(id, size),
        Body: body,
        ContentType: image.mime,
        // Photos are never modified after upload, so a given id can be cached forever.
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
  await Promise.all([put("full", image.data), put("thumb", image.thumb)]);
}

/** Removes the files of the given photos. Failures are logged, not thrown: the rows are already gone. */
export async function deletePhotoFiles(ids: string[]) {
  if (ids.length === 0) return;
  const keys = ids.flatMap((id) => [photoKey(id, "full"), photoKey(id, "thumb")]);
  try {
    const s3 = getS3();
    // DeleteObjects accepts up to 1000 keys per request.
    for (let i = 0; i < keys.length; i += 1000) {
      await s3.send(
        new DeleteObjectsCommand({
          Bucket: process.env.S3_BUCKET,
          Delete: { Objects: keys.slice(i, i + 1000).map((Key) => ({ Key })), Quiet: true },
        }),
      );
    }
  } catch (error) {
    console.error("[sihab] Failed to delete photo files", ids, error);
  }
}
