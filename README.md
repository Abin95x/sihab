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
npm run db:seed              # optional: copies the demo photos into the database
npm run dev                  # http://localhost:3000
```

### Environment variables

| Variable         | Purpose                                                                    |
| ---------------- | -------------------------------------------------------------------------- |
| `DATABASE_URL`   | PostgreSQL connection string. Hosted providers usually need `?sslmode=require`. |
| `ADMIN_USERNAME` | Admin login username.                                                      |
| `ADMIN_PASSWORD` | Admin login password. Changing it signs out existing sessions.             |
| `AUTH_SECRET`    | 32+ character random string for signing the session cookie (`openssl rand -base64 32`). |

## Demo photos

Until `DATABASE_URL` is set, the public pages show Sihab's photos from `public/demo/`: 7 on the homepage (reused from the stories), 7 stories on Editorial and 5 on Commercial. The titles and descriptions are in `src/lib/demo-content.json`. They can't be edited from the admin in this mode.

Once a database is connected the site shows only database content. To start from these photos instead of an empty site, run `npm run db:seed`. It copies them into the database, where they can be deleted from `/admin` like any other photo. It only fills sections that are empty, so it's safe to run again.

The demo photos come from Sihab's own Behance projects (© Sihab Sharafudheen, all rights reserved), resized to 1600px on the long edge. `public/demo/CREDITS.md` maps each file to its project. You can delete `public/demo/` once the photos are in the database.

## Managing photos

1. Go to `/admin/login` and sign in.
2. **Homepage** tab: add photos by tapping the upload box or dropping files onto it. Photos appear in upload order, numbered 01, 02, 03…
3. **Editorial** and **Commercial** tabs: create a story first, then add photos to it. The first photo in a story is shown large. New stories appear at the top.
4. Use **Delete** on a photo, or **Delete story** to remove a story and all its photos.

Uploads accept JPEG, PNG, WebP and AVIF. Large images are shrunk in the browser before upload. The server then fixes rotation, strips metadata (including GPS location), and stores two WebP versions: 2400px for the viewer and 1200px for the grids.

## How it's built

- **Database:** PostgreSQL through [Drizzle ORM](https://orm.drizzle.team). Schema: `src/lib/db/schema.ts`.
- **Image storage:** image bytes are stored in Postgres and served from `/api/photos/:id/(thumb|full)` with long-lived cache headers. Nothing but `DATABASE_URL` is needed, and it works on serverless hosts.
- **Auth:** single admin account from environment variables. The session is a signed, httpOnly JWT cookie (`jose`). Every admin page and Server Action checks the session on the server. Failed logins are throttled.
- **Editable copy:** name, bio, email and Instagram link live in `src/lib/site.ts`.

```
src/
  app/(site)/          public pages (home, editorial, commercial)
  app/admin/           admin dashboard, login, Server Actions
  app/api/photos/      image endpoint
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
| `npm run db:seed`     | Copy the demo photos into empty sections       |
| `npm run db:studio`   | Browse the database in Drizzle Studio          |

## Deploying

Set the four environment variables on your host and run `npm run db:push` once against the production database. On Vercel, each upload request must stay under 4.5 MB. The in-browser resizing keeps typical camera photos well under that.
