import Link from "next/link";
import { isDbConfigured } from "@/lib/db";
import styles from "./admin.module.css";
import { LinkPending } from "./link-pending";
import { LogoutButton } from "./logout-button";

export const ADMIN_TABS = [
  { id: "home", label: "Homepage", description: "Front page gallery" },
  { id: "editorial", label: "Editorial", description: "Magazine stories" },
  { id: "commercial", label: "Commercial", description: "Client work" },
] as const;

export type AdminTabId = (typeof ADMIN_TABS)[number]["id"];

type Props = { active: AdminTabId };

const TAB_ICONS: Record<AdminTabId, React.ReactNode> = {
  // House
  home: <path d="M3 10.5 12 3l9 7.5M5 9v11h5v-6h4v6h5V9" />,
  // Open magazine
  editorial: <path d="M12 6.5C10 5 7 4.5 3 5v13c4-.5 7 0 9 1.5m0-13c2-1.5 5-2 9-1.5v13c-4-.5-7 0-9 1.5m0-13v13" />,
  // Briefcase
  commercial: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M3 13h18" />
    </>
  ),
};

export function AdminSidebar({ active }: Props) {
  const dbReady = isDbConfigured();

  return (
    <aside className={styles.sidebar}>
      <Link href="/admin" className={styles.wordmark}>
        Admin
      </Link>

      <nav className={styles.nav} aria-label="Sections">
        <ul className={styles.navList}>
          {ADMIN_TABS.map((t) => (
            <li key={t.id}>
              <Link
                href={`/admin?tab=${t.id}`}
                className={styles.navLink}
                aria-current={t.id === active ? "page" : undefined}
              >
                <LinkPending size={16}>
                  <svg
                    className={styles.navIcon}
                    viewBox="0 0 24 24"
                    width="16"
                    height="16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    {TAB_ICONS[t.id]}
                  </svg>
                </LinkPending>
                {t.label}
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
        <div className={styles.account}>
          <LogoutButton />
        </div>
      </div>
    </aside>
  );
}
