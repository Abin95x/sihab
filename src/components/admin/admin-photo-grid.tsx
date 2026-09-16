"use client";

import { useOptimistic, useState, useTransition } from "react";
import { deletePhoto } from "@/app/admin/actions";
import { pad2, photoUrl, type PhotoMeta } from "@/lib/photos";
import styles from "./admin.module.css";

export function AdminPhotoGrid({ photos }: { photos: PhotoMeta[] }) {
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [visible, hide] = useOptimistic(photos, (state, id: string) => state.filter((p) => p.id !== id));

  if (photos.length === 0) {
    return <p className={styles.hint}>No photos yet.</p>;
  }

  function remove(photo: PhotoMeta, number: string) {
    if (!window.confirm(`Delete photo ${number}? This cannot be undone.`)) return;
    setError(null);
    startTransition(async () => {
      hide(photo.id);
      const result = await deletePhoto(photo.id);
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
          const number = pad2(photos.indexOf(photo) + 1);
          return (
            <li key={photo.id} className={styles.tile}>
              {/* eslint-disable-next-line @next/next/no-img-element -- served from the photo API */}
              <img src={photoUrl(photo, "thumb")} alt={`Photo ${number}`} loading="lazy" decoding="async" />
              <span className={styles.tileNumber}>{number}</span>
              <button
                type="button"
                className={styles.tileDelete}
                onClick={() => remove(photo, number)}
                aria-label={`Delete photo ${number}`}
              >
                Delete
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}
