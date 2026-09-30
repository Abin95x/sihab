import { ADMIN_TABS, AdminSidebar, type AdminTabId } from "@/components/admin/admin-sidebar";
import { AdminPhotoGrid } from "@/components/admin/admin-photo-grid";
import styles from "@/components/admin/admin.module.css";
import { NewShootDialog } from "@/components/admin/new-shoot-dialog";
import { ShootFolders } from "@/components/admin/shoot-folders";
import { ShootView } from "@/components/admin/shoot-view";
import { requireAdmin } from "@/lib/auth";
import { queryHomePhotos, queryStories } from "@/lib/data";
import { isDbConfigured } from "@/lib/db";
import { type PhotoMeta, type StoryWithPhotos } from "@/lib/photos";

export default async function AdminPage({ searchParams }: PageProps<"/admin">) {
  await requireAdmin();
  const { tab, shoot } = await searchParams;
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
      else stories = await queryStories(active, { includeArchived: true });
    } catch (error) {
      console.error("[sihab] Admin failed to load data", error);
      loadError = "Could not reach the database. Check DATABASE_URL and that the tables exist (`npm run db:push`).";
    }
  }

  const activeLabel = ADMIN_TABS.find((t) => t.id === active)!.label;
  const openShoot = active !== "home" && typeof shoot === "string" ? stories.find((s) => s.id === shoot) : undefined;
  const liveShoots = stories.filter((s) => !s.archived);
  const archivedShoots = stories.filter((s) => s.archived);

  return (
    <div className={styles.shell}>
      <AdminSidebar active={active} />

      <main className={styles.content}>
        {loadError && (
          <p className={styles.alert} role="alert">
            {loadError}
          </p>
        )}

        {active === "home" ? (
          <section className={styles.section}>
            <header className={styles.sectionHead}>
              <h1>Homepage</h1>
              <p className={styles.hint}>
                Starred story photos, shown on the homepage in the order they were starred. {homePhotos.length} photo
                {homePhotos.length === 1 ? "" : "s"}.
              </p>
            </header>
            <AdminPhotoGrid photos={homePhotos} />
          </section>
        ) : openShoot ? (
          <ShootView key={openShoot.id} section={active} sectionLabel={activeLabel} shoot={openShoot} />
        ) : (
          <section className={styles.section}>
            <header className={styles.sectionHead}>
              <div className={styles.headRow}>
                <h1>{activeLabel}</h1>
                <NewShootDialog section={active} />
              </div>
              <p className={styles.hint}>
                Each shoot is a folder of photos. Open one to add or remove photos, or drag folders to reorder them.
              </p>
            </header>
            {liveShoots.length > 0 ? (
              <ShootFolders section={active} shoots={liveShoots} />
            ) : (
              !loadError && (
                <p className={styles.empty}>{archivedShoots.length > 0 ? "No active shoots." : "No shoots yet."}</p>
              )
            )}
            {archivedShoots.length > 0 && (
              <section className={styles.archive} aria-labelledby="archived-shoots">
                <h2 id="archived-shoots" className={styles.subhead}>
                  Archived · hidden from the site
                </h2>
                <ShootFolders section={active} shoots={archivedShoots} />
              </section>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
