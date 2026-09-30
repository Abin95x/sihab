// One-off: imports Sihab's own Behance projects (plan.json) into the DB + bucket.
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { DeleteObjectsCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import nextEnv from "@next/env";
import pg from "pg";
import sharp from "sharp";

nextEnv.loadEnvConfig(process.cwd());
const SCRATCH = process.argv[2];
const plan = JSON.parse(readFileSync(`${SCRATCH}/plan.json`, "utf8"));
const STAR_PER_SECTION = 6;

const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION || "us-east-1",
  forcePathStyle: true,
  credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY },
});
const photoKey = (id, size) => `photos/${id}/${size}.webp`;
const FULL_MAX_EDGE = 2400;
const THUMB_MAX_EDGE = 1200;

async function download(url) {
  const candidates = url.includes("/source/") ? [url.replace("/source/", "/max_3840/"), url] : [url];
  for (const u of candidates) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetch(u, { redirect: "manual" }).catch(() => null);
      if (res?.status === 200) return Buffer.from(await res.arrayBuffer());
      if (res && res.status >= 300 && res.status < 500) break; // try next candidate
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  throw new Error(`download failed: ${url}`);
}

async function processImage(input) {
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
  // Difference hash, to drop the same frame uploaded twice.
  const px = await base.clone().greyscale().resize(9, 8, { fit: "fill" }).raw().toBuffer();
  let hash = 0n;
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) hash = (hash << 1n) | (px[y * 9 + x] > px[y * 9 + x + 1] ? 1n : 0n);
  return { full: full.data, thumb, width: full.info.width, height: full.info.height, hash };
}
const hamming = (a, b) => {
  let v = a ^ b, n = 0;
  while (v) { n += Number(v & 1n); v >>= 1n; }
  return n;
};

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: limit }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i], i); }
  }));
  return out;
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const report = { added: [], skipped: [], duplicates: [], small: [], failed: [] };
const seenHashes = [];
const sectionIndex = { editorial: 0, commercial: 0 };
const covers = { editorial: [], commercial: [] };

for (const shoot of plan) {
  const order = sectionIndex[shoot.section]++;
  const { rows: existing } = await client.query("select 1 from stories where section = $1 and title = $2", [shoot.section, shoot.title]);
  if (existing.length) { report.skipped.push(shoot.title); console.log(`skip (exists): ${shoot.title}`); continue; }

  const uploaded = [];
  try {
    const processed = await mapLimit(shoot.photos, 4, async (p) => ({ ...p, img: await processImage(await download(p.url)) }));
    const kept = [];
    for (const p of processed) {
      const dupe = seenHashes.find((h) => hamming(h.hash, p.img.hash) <= 4);
      if (dupe) { report.duplicates.push({ shoot: shoot.title, url: p.url, sameAs: dupe.url }); continue; }
      seenHashes.push({ hash: p.img.hash, url: p.url });
      if (Math.max(p.img.width, p.img.height) < 1000) report.small.push({ shoot: shoot.title, url: p.url, w: p.img.width, h: p.img.height });
      kept.push({ ...p, id: randomUUID() });
    }
    await mapLimit(kept, 6, async (p) => {
      for (const [size, body] of [["full", p.img.full], ["thumb", p.img.thumb]]) {
        const Key = photoKey(p.id, size);
        await s3.send(new PutObjectCommand({ Bucket: process.env.S3_BUCKET, Key, Body: body, ContentType: "image/webp", CacheControl: "public, max-age=31536000, immutable" }));
        uploaded.push(Key);
      }
    });
    await client.query("begin");
    const { rows } = await client.query(
      "insert into stories (section, title, description, sort_order) values ($1, $2, '', $3) returning id",
      [shoot.section, shoot.title, order],
    );
    for (const [j, p] of kept.entries()) {
      await client.query(
        "insert into photos (id, section, story_id, width, height, sort_order) values ($1, $2, $3, $4, $5, $6)",
        [p.id, shoot.section, rows[0].id, p.img.width, p.img.height, j],
      );
    }
    await client.query("commit");
    if (kept[0]) covers[shoot.section].push(kept[0].id);
    report.added.push({ section: shoot.section, title: shoot.title, photos: kept.length });
    console.log(`added ${shoot.section}: ${shoot.title} (${kept.length})`);
  } catch (error) {
    await client.query("rollback").catch(() => {});
    if (uploaded.length) {
      await s3.send(new DeleteObjectsCommand({ Bucket: process.env.S3_BUCKET, Delete: { Objects: uploaded.map((Key) => ({ Key })), Quiet: true } })).catch(() => {});
    }
    report.failed.push({ title: shoot.title, error: error.message });
    console.error(`FAILED ${shoot.title}: ${error.message}`);
  }
}

// Star the covers of the newest shoots for the homepage, alternating editorial / commercial.
const toStar = [];
for (let i = 0; i < STAR_PER_SECTION; i++) for (const s of ["editorial", "commercial"]) if (covers[s][i]) toStar.push(covers[s][i]);
const now = Date.now();
for (const [i, id] of toStar.entries()) {
  await client.query("update photos set featured_at = $1 where id = $2", [new Date(now + i * 1000), id]);
}
report.starred = toStar.length;
await client.end();
writeFileSync(`${SCRATCH}/import-report.json`, JSON.stringify(report, null, 1));
console.log(`done: ${report.added.length} shoots added, ${report.skipped.length} skipped, ${report.failed.length} failed, ${report.duplicates.length} duplicate frames dropped, ${toStar.length} starred`);
