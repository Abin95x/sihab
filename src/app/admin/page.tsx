import { ADMIN_TABS, AdminSidebar, type AdminTabId } from "@/components/admin/admin-sidebar";
import { AdminPhotoGrid } from "@/components/admin/admin-photo-grid";
import styles from "@/components/admin/admin.module.css";
import { NewStoryForm } from "@/components/admin/new-story-form";
import { StoryPanel } from "@/components/admin/story-panel";
import { requireAdmin } from "@/lib/auth";
import { queryHomePhotos, queryStories } from "@/lib/data";
import { isDbConfigured } from "@/lib/db";
import { type PhotoMeta, type StoryWithPhotos } from "@/lib/photos";

export default async function AdminPage({ searchParams }: PageProps<"/admin">) {
  const session = await requireAdmin();
  const { tab } = await searchParams;
  const active: AdminTabId = ADMIN_TABS.some((t) => t.id === tab) ? (tab as AdminTabId) : "home";

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

  const activeLabel = ADMIN_TABS.find((t) => t.id === active)!.label;

  return (
    <div className={styles.shell}>
      <AdminSidebar active={active} username={session.username} />

      <main className={styles.content}>
        {loadError && (
          <p className={styles.alert} role="alert">
            {loadError}
          </p>
        )}

        {active === "home" ? (
          <section className={styles.section}>
            <header className={styles.sectionHead}>
              <p className={styles.eyebrow}>{activeLabel}</p>
              <h1>Homepage photos</h1>
              <p className={styles.hint}>
                Starred story photos, shown on the homepage in the order they were starred. {homePhotos.length} photo
                {homePhotos.length === 1 ? "" : "s"}.
              </p>
            </header>
            <AdminPhotoGrid photos={homePhotos} />
          </section>
        ) : (
          <section className={styles.section}>
            <header className={styles.sectionHead}>
              <p className={styles.eyebrow}>{activeLabel}</p>
              <h1>{activeLabel} stories</h1>
              <p className={styles.hint}>
                Each story is a title, a short description and a set of photos. The first photo is shown large.
              </p>
            </header>
            <NewStoryForm section={active} />
            {stories.length === 0 && !loadError && <p className={styles.empty}>No stories yet. Create one above.</p>}
            {stories.map((story, i) => (
              <StoryPanel key={story.id} section={active} story={story} defaultOpen={i === 0} />
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
