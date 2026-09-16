// Copies the demo photos in public/demo into the database so they can be managed (and deleted) from /admin.
// Usage: npm run db:seed
// Only fills sections that are still empty, so it is safe to run more than once.

import { readFileSync } from "node:fs";
import nextEnv from "@next/env";
import pg from "pg";
import sharp from "sharp";

nextEnv.loadEnvConfig(process.cwd());

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Add it to .env.local first.");
  process.exit(1);
}

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

async function insertPhoto(client, section, storyId, file, sortOrder) {
  const image = await processImage(file);
  await client.query(
    `insert into photos (section, story_id, width, height, mime, data, thumb, sort_order)
     values ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [section, storyId, image.width, image.height, image.mime, image.data, image.thumb, sortOrder],
  );
}

const content = JSON.parse(readFileSync(new URL("../src/lib/demo-content.json", import.meta.url), "utf8"));
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

try {
  const { rows: homeRows } = await client.query("select count(*)::int as n from photos where section = 'home'");
  if (homeRows[0].n > 0) {
    console.log("Homepage already has photos — skipped.");
  } else {
    await client.query("begin");
    for (const [i, photo] of content.home.entries()) {
      await insertPhoto(client, "home", null, photo.file, i);
    }
    await client.query("commit");
    console.log(`Homepage: added ${content.home.length} photos.`);
  }

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
        await insertPhoto(client, section, inserted[0].id, photo.file, j);
      }
    }
    await client.query("commit");
    console.log(`${section}: added ${content[section].length} stories.`);
  }
} catch (error) {
  await client.query("rollback").catch(() => {});
  console.error("Seeding failed:", error.message);
  console.error("Have you created the tables with `npm run db:push`?");
  process.exitCode = 1;
} finally {
  await client.end();
}
