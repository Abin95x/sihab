import Link from "next/link";
import { AdminPhotoGrid } from "@/components/admin/admin-photo-grid";
import styles from "@/components/admin/admin.module.css";
import { NewStoryForm } from "@/components/admin/new-story-form";
import { StoryPanel } from "@/components/admin/story-panel";
import { UploadDropzone } from "@/components/admin/upload-dropzone";
import { requireAdmin } from "@/lib/auth";
import { queryHomePhotos, queryStories } from "@/lib/data";
import { isDbConfigured } from "@/lib/db";
import type { PhotoMeta, StoryWithPhotos } from "@/lib/photos";
import { site } from "@/lib/site";
import { logout } from "./actions";

const TABS = [
  { id: "home", label: "Homepage" },
  { id: "editorial", label: "Editorial" },
  { id: "commercial", label: "Commercial" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default async function AdminPage({ searchParams }: PageProps<"/admin">) {
  const session = await requireAdmin();
  const { tab } = await searchParams;
  const active: TabId = TABS.some((t) => t.id === tab) ? (tab as TabId) : "home";

  let homePhotos: PhotoMeta[] = [];
  let stories: StoryWithPhotos[] = [];
  let loadError: string | null = null;

  if (!isDbConfigured()) {
    loadError =
      "Database is not configured, so the public pages are showing demo photos. Add DATABASE_URL, run `npm run db:push` (and optionally `npm run db:seed` to copy the demo photos in), then restart.";
  } else {
    try {
      if (active === "home") homePhotos = await queryHomePhotos();
      else stories = await queryStories(active);
    } catch (error) {
      console.error("[sihab] Admin failed to load data", error);
      loadError = "Could not reach the database. Check DATABASE_URL and that the tables exist (`npm run db:push`).";
    }
  }

  const activeLabel = TABS.find((t) => t.id === active)!.label;

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <p className={styles.brand}>
          {site.name} <span className={styles.brandMuted}>Admin</span>
        </p>
        <div className={styles.topbarActions}>
          <span className={styles.user}>{session.username}</span>
          <Link href="/" className={styles.ghost} target="_blank">
            View site
          </Link>
          <form action={logout}>
            <button type="submit" className={styles.ghost}>
              Log out
            </button>
          </form>
        </div>
      </header>

      <nav className={styles.tabs} aria-label="Sections">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/admin?tab=${t.id}`}
            className={styles.tab}
            aria-current={t.id === active ? "page" : undefined}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <main className={styles.content}>
        {loadError && (
          <p className={styles.alert} role="alert">
            {loadError}
          </p>
        )}

        {active === "home" ? (
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h1>Homepage photos</h1>
              <p className={styles.hint}>
                Shown on the homepage in upload order and numbered 01, 02, 03… {homePhotos.length} photo
                {homePhotos.length === 1 ? "" : "s"}.
              </p>
            </div>
            <UploadDropzone section="home" />
            <AdminPhotoGrid photos={homePhotos} />
          </section>
        ) : (
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h1>{activeLabel} stories</h1>
              <p className={styles.hint}>
                Each story is a title, a short description and a set of photos. The first photo is shown large.
              </p>
            </div>
            <NewStoryForm section={active} />
            {stories.length === 0 && !loadError && <p className={styles.hint}>No stories yet — create one above.</p>}
            {stories.map((story, i) => (
              <StoryPanel key={story.id} section={active} story={story} defaultOpen={i === 0} />
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
