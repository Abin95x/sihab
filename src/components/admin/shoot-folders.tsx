import Link from "next/link";
import type { Section, StoryWithPhotos } from "@/lib/photos";
import styles from "./admin.module.css";

type Props = { section: Section; shoots: StoryWithPhotos[] };

export function ShootFolders({ section, shoots }: Props) {
  return (
    <ul className={styles.folders}>
      {shoots.map((shoot) => {
        const count = shoot.photos.length;
        const archived = shoot.photos.filter((p) => p.archived).length;
        return (
          <li key={shoot.id}>
            <Link
              href={`/admin?tab=${section}&shoot=${shoot.id}`}
              className={styles.folder}
              data-archived={shoot.archived || undefined}
            >
              <span className={styles.folderFrame} aria-hidden="true" />
              <span className={styles.folderName}>{shoot.title}</span>
              <span className={styles.folderMeta}>
                {count} photo{count === 1 ? "" : "s"}
                {archived > 0 && ` · ${archived} archived`}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
