import Link from "next/link";
import { logout } from "@/app/admin/actions";
import { isDbConfigured } from "@/lib/db";
import styles from "./admin.module.css";

export const ADMIN_TABS = [
  { id: "home", label: "Homepage", description: "Front page gallery" },
  { id: "editorial", label: "Editorial", description: "Magazine stories" },
  { id: "commercial", label: "Commercial", description: "Client work" },
] as const;

export type AdminTabId = (typeof ADMIN_TABS)[number]["id"];

type Props = { active: AdminTabId; username: string };

export function AdminSidebar({ active, username }: Props) {
  const dbReady = isDbConfigured();

  return (
    <aside className={styles.sidebar}>
      <Link href="/admin" className={styles.wordmark}>
        Admin
      </Link>

      <nav className={styles.nav} aria-label="Sections">
        <p className={styles.navLabel}>Sections</p>
        <ul className={styles.navList}>
          {ADMIN_TABS.map((t) => (
            <li key={t.id}>
              <Link
                href={`/admin?tab=${t.id}`}
                className={styles.navLink}
                aria-current={t.id === active ? "page" : undefined}
              >
                <span className={styles.navTitle}>{t.label}</span>
                <span className={styles.navDescription}>{t.description}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className={styles.sidebarFoot}>
        <p className={styles.status} data-ready={dbReady || undefined}>
          <span className={styles.statusDot} aria-hidden="true" />
          {dbReady ? "Database connected" : "Demo mode · no database"}
        </p>
        <Link href="/" target="_blank" className={styles.sideLink}>
          View site
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
            <path d="M5 3h8v8M13 3 3 13" fill="none" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        </Link>
        <div className={styles.account}>
          <span className={styles.avatar} aria-hidden="true">
            {username.charAt(0).toUpperCase()}
          </span>
          <span className={styles.accountMeta}>
            <span className={styles.accountName}>{username}</span>
            <span className={styles.accountRole}>Signed in</span>
          </span>
          <form action={logout}>
            <button type="submit" className={styles.logout}>
              Log out
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
