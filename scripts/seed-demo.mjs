// Copies the demo photos in public/demo into the database and storage bucket so they can be managed (and deleted) from /admin.
// Usage: npm run db:seed
// Only fills sections that are still empty, so it is safe to run more than once.

import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { DeleteObjectsCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import nextEnv from "@next/env";
import pg from "pg";
import sharp from "sharp";

nextEnv.loadEnvConfig(process.cwd());

for (const name of ["DATABASE_URL", "S3_ENDPOINT", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY", "S3_BUCKET"]) {
  if (!process.env[name]) {
    console.error(`${name} is not set. Add it to .env first.`);
    process.exit(1);
  }
}

const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION || "us-east-1",
  forcePathStyle: true,
  credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY },
});
// Keep in sync with photoKey() in src/lib/photos.ts.
const photoKey = (id, size) => `photos/${id}/${size}.webp`;

// Keep in sync with FULL_MAX_EDGE / THUMB_MAX_EDGE and processImage() in src/lib.
const FULL_MAX_EDGE = 2400;
const THUMB_MAX_EDGE = 1200;

async function processImage(file) {
  const base = sharp(readFileSync(new URL(`../public/demo/${file}`, import.meta.url))).rotate();
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
  return { data: full.data, thumb, width: full.info.width, height: full.info.height, mime: "image/webp" };
}

// Keys uploaded for the section being seeded, removed again if it fails.
const uploadedKeys = [];

async function insertPhoto(client, section, storyId, file, sortOrder, featuredAt) {
  const image = await processImage(file);
  const id = randomUUID();
  for (const [size, body] of [["full", image.data], ["thumb", image.thumb]]) {
    const Key = photoKey(id, size);
    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key,
        Body: body,
        ContentType: image.mime,
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
    uploadedKeys.push(Key);
  }
  await client.query(
    `insert into photos (id, section, story_id, width, height, sort_order, featured_at)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [id, section, storyId, image.width, image.height, sortOrder, featuredAt],
  );
}

const content = JSON.parse(readFileSync(new URL("../src/lib/demo-content.json", import.meta.url), "utf8"));

// The demo homepage photos are all taken from the stories, so they are seeded as starred story photos.
// The homepage lists starred photos by star time, so space the times out to keep the demo order.
const seededAt = Date.now();
const starTimes = new Map(content.home.map((photo, i) => [photo.file, new Date(seededAt + i * 1000)]));
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

try {
  for (const section of ["editorial", "commercial"]) {
    const { rows } = await client.query("select count(*)::int as n from stories where section = $1", [section]);
    if (rows[0].n > 0) {
      console.log(`${section}: already has stories — skipped.`);
      continue;
    }
    await client.query("begin");
    for (const [i, story] of content[section].entries()) {
      const { rows: inserted } = await client.query(
        "insert into stories (section, title, description, sort_order) values ($1, $2, $3, $4) returning id",
        [section, story.title, story.description, i],
      );
      for (const [j, photo] of story.photos.entries()) {
        await insertPhoto(client, section, inserted[0].id, photo.file, j, starTimes.get(photo.file) ?? null);
      }
    }
    await client.query("commit");
    uploadedKeys.length = 0;
    console.log(`${section}: added ${content[section].length} stories.`);
  }
} catch (error) {
  await client.query("rollback").catch(() => {});
  if (uploadedKeys.length > 0) {
    await s3
      .send(
        new DeleteObjectsCommand({
          Bucket: process.env.S3_BUCKET,
          Delete: { Objects: uploadedKeys.map((Key) => ({ Key })), Quiet: true },
        }),
      )
      .catch(() => {});
  }
  console.error("Seeding failed:", error.message);
  console.error("Have you created the tables with `npm run db:push`?");
  process.exitCode = 1;
} finally {
  await client.end();
}
