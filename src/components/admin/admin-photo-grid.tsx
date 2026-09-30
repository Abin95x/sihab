"use client";

import { useOptimistic, useState, useTransition } from "react";
import { deletePhoto, setPhotoArchived } from "@/app/admin/actions";
import { pad2, photoUrl, type PhotoMeta } from "@/lib/photos";
import styles from "./admin.module.css";

type Change = { id: string; removed: true } | { id: string; archived: boolean };

export function AdminPhotoGrid({ photos }: { photos: PhotoMeta[] }) {
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [visible, apply] = useOptimistic(photos, (state, change: Change) =>
    "removed" in change
      ? state.filter((p) => p.id !== change.id)
      : state.map((p) => (p.id === change.id ? { ...p, archived: change.archived } : p)),
  );

  if (photos.length === 0) {
    return <p className={styles.empty}>No photos yet.</p>;
  }

  const numbers = new Map(photos.map((p, i) => [p.id, pad2(i + 1)]));

  function remove(photo: PhotoMeta, number: string) {
    if (!window.confirm(`Delete photo ${number}? This cannot be undone.`)) return;
    setError(null);
    startTransition(async () => {
      apply({ id: photo.id, removed: true });
      const result = await deletePhoto(photo.id);
      if (result.error) setError(result.error);
    });
  }

  function toggleArchived(photo: PhotoMeta) {
    const archived = !photo.archived;
    setError(null);
    startTransition(async () => {
      apply({ id: photo.id, archived });
      const result = await setPhotoArchived(photo.id, archived);
      if (result.error) setError(result.error);
    });
  }

  return (
    <>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <ul className={styles.grid}>
        {visible.map((photo) => {
          const number = numbers.get(photo.id)!;
          return (
            <li key={photo.id} className={styles.tile} data-archived={photo.archived || undefined}>
              {/* eslint-disable-next-line @next/next/no-img-element -- served from the storage bucket */}
              <img src={photoUrl(photo, "thumb")} alt={`Photo ${number}`} loading="lazy" decoding="async" />
              <span className={styles.tileNumber}>{number}</span>
              {photo.archived && <span className={styles.tileTag}>Archived</span>}
              <span className={styles.tileActions}>
                <button
                  type="button"
                  className={styles.tileButton}
                  onClick={() => toggleArchived(photo)}
                  aria-label={`${photo.archived ? "Restore" : "Archive"} photo ${number}`}
                >
                  {photo.archived ? "Restore" : "Archive"}
                </button>
                <button
                  type="button"
                  className={`${styles.tileButton} ${styles.tileDelete}`}
                  onClick={() => remove(photo, number)}
                  aria-label={`Delete photo ${number}`}
                >
                  Delete
                </button>
              </span>
            </li>
          );
        })}
      </ul>
    </>
  );
}
