# Sihab

Photography portfolio built with Next.js 16 (App Router) and TypeScript. It has three public pages and a password-protected admin for managing photos.

- `/`: homepage. Giant scrolling name in the background, a staggered two-column gallery with large numbers, and a bio.
- `/editorial`: editorial stories. Each has a title, one large photo, a collage of the rest and a short description.
- `/commercial`: commercial stories, same layout.
- `/admin`: sign in to add and delete photos and to create, edit and delete stories.

Clicking any photo opens a full-screen viewer. It supports keyboard arrows, swipe on mobile, and Esc to close.

## Setup

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run db:push              # creates the tables in your database
npm run admin:create -- <username>   # creates the admin account; asks for a password
npm run dev                  # http://localhost:3000
```

### Environment variables

| Variable         | Purpose                                                                    |
| ---------------- | -------------------------------------------------------------------------- |
| `DATABASE_URL`   | PostgreSQL connection string (Supabase: use the session pooler URL). |
| `S3_ENDPOINT`, `S3_REGION` | S3-compatible storage endpoint and region for the photo files (Supabase: Storage > S3). |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Storage access key. |
| `S3_BUCKET`      | Bucket name. It must be public, since pages link to the files directly. |
| `NEXT_PUBLIC_PHOTOS_URL` | Public URL of the bucket, e.g. `https://<project>.supabase.co/storage/v1/object/public/<bucket>`. Inlined at build time. |
| `AUTH_SECRET`    | 32+ character random string for signing the session cookie (`openssl rand -base64 32`). |

## Admin accounts

Admin accounts live in the `admins` table. Passwords are stored only as scrypt hashes (N=2^17, r=8, p=1, per-password salt).

- Create an account, or set a new password for an existing one: `npm run admin:create -- <username>`. It asks for the password (12+ characters) without echoing it. Setting a new password signs that account out everywhere.
- Moving from the old `ADMIN_USERNAME` / `ADMIN_PASSWORD` variables: run `npm run admin:create` with them still in `.env`, then delete both. They are no longer read by the app.

## Managing photos

1. Go to `/admin/login` and sign in.
2. **Homepage** tab: add photos by tapping the upload box or dropping files onto it. Photos appear in upload order, numbered 01, 02, 03…
3. **Editorial** and **Commercial** tabs: create a story first, then add photos to it. The first photo in a story is shown large. New stories appear at the top.
4. Use **Delete** on a photo, or **Delete story** to remove a story and all its photos.

Uploads accept JPEG, PNG, WebP and AVIF. Large images are shrunk in the browser before upload. The server then fixes rotation, strips metadata (including GPS location), and stores two WebP versions: 2400px for the viewer and 1200px for the grids.

## How it's built

- **Database:** PostgreSQL through [Drizzle ORM](https://orm.drizzle.team). Schema: `src/lib/db/schema.ts`.
- **Image storage:** image files go to an S3-compatible public bucket (Supabase Storage) as `photos/<id>/full.webp` and `photos/<id>/thumb.webp`, with long-lived cache headers. Postgres holds only the photo metadata.
- **Auth:** admin accounts in Postgres with scrypt password hashes. The session is a signed, httpOnly JWT cookie (`jose`) that is checked against the account on every admin request, so changing a password ends its sessions. Every admin page and Server Action checks the session on the server.
- **Security:** `src/proxy.ts` sends a nonce-based Content-Security-Policy on every page and throttles each IP (pages, Server Actions and login attempts separately). Login attempts are also limited in the database (`rate_limits` table) per IP and per username, so the limit holds across server instances. Other security headers (HSTS, `nosniff`, `X-Frame-Options`, …) are set in `next.config.ts`. Server Actions validate every argument; uploads are checked by decoded image format and pixel count, not by file name or MIME type. All queries go through Drizzle's parameterised SQL.
- **Caching:** public pages read their data through `unstable_cache` (`src/lib/data.ts`), so visits don't hit Postgres. Every admin change invalidates the cache immediately.
- **Editable copy:** name, bio, email and Instagram link live in `src/lib/site.ts`.

```
src/
  app/(site)/          public pages (home, editorial, commercial)
  app/admin/           admin dashboard, login, Server Actions
  app/api/more/        next slice of a public list, for infinite scroll and search
  components/          header, footer, marquee, lightbox, story list
  components/admin/    upload box, photo grid, story forms
  lib/                 db, auth, data queries, image processing, site config
```

## Scripts

| Command               | Description                                    |
| --------------------- | ---------------------------------------------- |
| `npm run dev`         | Start the dev server                           |
| `npm run build`       | Production build                               |
| `npm start`           | Run the production build                       |
| `npm run typecheck`   | Generate route types and run TypeScript        |
| `npm run lint`        | ESLint                                         |
| `npm run db:push`     | Apply the schema to the database               |
| `npm run db:generate` | Generate SQL migration files instead of pushing |
| `npm run admin:create -- <username>` | Create an admin, or reset its password |
| `npm run db:studio`   | Browse the database in Drizzle Studio          |

## Deploying

A Vercel Cron job (`vercel.json`) calls `/api/cron/ping` once a day, which queries the database so a free Supabase project isn't paused for inactivity. Set `CRON_SECRET` in Vercel's environment variables for it to work.

Set the environment variables on your host, run `npm run db:push` once against the production database, and create an admin with `npm run admin:create`. On Vercel, each upload request must stay under 4.5 MB. The in-browser resizing keeps typical camera photos well under that.
