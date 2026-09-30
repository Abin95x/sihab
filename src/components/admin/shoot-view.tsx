"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type SubmitEvent } from "react";
import { deleteStory, setStoryArchived, updateStory } from "@/app/admin/actions";
import type { Section, StoryWithPhotos } from "@/lib/photos";
import { AdminPhotoGrid } from "./admin-photo-grid";
import styles from "./admin.module.css";
import { UploadDropzone } from "./upload-dropzone";

type Props = { section: Section; sectionLabel: string; shoot: StoryWithPhotos };

export function ShootView({ section, sectionLabel, shoot }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, startSave] = useTransition();
  const [archiving, startArchive] = useTransition();
  const [deleting, startDelete] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const count = shoot.photos.length;
  const archivedCount = shoot.photos.filter((p) => p.archived).length;
  const back = `/admin?tab=${section}`;

  function save(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);
    startSave(async () => {
      const result = await updateStory({}, formData);
      if (result.error) setError(result.error);
      else setEditing(false);
    });
  }

  function toggleArchived() {
    setError(null);
    startArchive(async () => {
      const result = await setStoryArchived(shoot.id, !shoot.archived);
      if (result.error) setError(result.error);
    });
  }

  function remove() {
    const warning = count > 0 ? ` and its ${count} photo${count === 1 ? "" : "s"}` : "";
    if (!window.confirm(`Delete “${shoot.title}”${warning}? This cannot be undone.`)) return;
    setError(null);
    startDelete(async () => {
      const result = await deleteStory(shoot.id);
      if (result.error) setError(result.error);
      else router.push(back);
    });
  }

  return (
    <section className={styles.section} data-busy={deleting || undefined}>
      <header className={styles.sectionHead}>
        <Link href={back} className={styles.back}>
          <svg
            viewBox="0 0 24 24"
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M19 12H5M11 18l-6-6 6-6" />
          </svg>
          Back to {sectionLabel}
        </Link>
        <div className={styles.headRow}>
          <h1>{shoot.title}</h1>
          <div className={styles.row}>
            <button
              type="button"
              className={styles.secondary}
              aria-expanded={editing}
              onClick={() => setEditing((open) => !open)}
            >
              Edit details
            </button>
            <button type="button" className={styles.secondary} onClick={toggleArchived} disabled={archiving}>
              {archiving ? "Saving…" : shoot.archived ? "Unarchive" : "Archive"}
            </button>
            <button type="button" className={styles.danger} onClick={remove} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete shoot"}
            </button>
          </div>
        </div>
        {shoot.description && <p className={styles.description}>{shoot.description}</p>}
        <p className={styles.hint}>
          {count} photo{count === 1 ? "" : "s"}
          {archivedCount > 0 && `, ${archivedCount} archived`}. The first photo is shown large on the site; archived
          photos are hidden.
        </p>
      </header>

      {shoot.archived && (
        <p className={styles.notice}>This shoot is archived. It and all its photos are hidden from the site.</p>
      )}

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {editing && (
        <form onSubmit={save} className={`${styles.form} ${styles.card}`}>
          <input type="hidden" name="id" value={shoot.id} />
          <label className={styles.field}>
            <span>Title</span>
            <input name="title" required maxLength={200} defaultValue={shoot.title} />
          </label>
          <label className={styles.field}>
            <span>Description</span>
            <textarea name="description" rows={3} maxLength={5000} defaultValue={shoot.description} />
          </label>
          <div className={styles.row}>
            <button type="submit" className={styles.primary} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
            <button type="button" className={styles.secondary} onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <UploadDropzone section={section} storyId={shoot.id} />
      <AdminPhotoGrid photos={shoot.photos} />
    </section>
  );
}
