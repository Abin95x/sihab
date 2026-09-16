"use client";

import { useState, useTransition } from "react";
import { deleteStory, updateStory } from "@/app/admin/actions";
import type { StorySection, StoryWithPhotos } from "@/lib/photos";
import { AdminPhotoGrid } from "./admin-photo-grid";
import styles from "./admin.module.css";
import { UploadDropzone } from "./upload-dropzone";
import { useFormAction } from "./use-form-action";

type Props = { section: StorySection; story: StoryWithPhotos; defaultOpen: boolean };

export function StoryPanel({ section, story, defaultOpen }: Props) {
  const { state, pending: saving, onSubmit } = useFormAction(updateStory);
  const [deleting, startDelete] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const count = story.photos.length;

  function remove() {
    const warning = count > 0 ? ` and its ${count} photo${count === 1 ? "" : "s"}` : "";
    if (!window.confirm(`Delete “${story.title}”${warning}? This cannot be undone.`)) return;
    setDeleteError(null);
    startDelete(async () => {
      const result = await deleteStory(story.id);
      if (result.error) setDeleteError(result.error);
    });
  }

  return (
    <details className={styles.card} open={defaultOpen} data-busy={deleting || undefined}>
      <summary className={styles.summary}>
        <span className={styles.cardTitle}>{story.title}</span>
        <span className={styles.hint}>
          {count} photo{count === 1 ? "" : "s"}
        </span>
      </summary>

      <div className={styles.panelBody}>
        <form onSubmit={onSubmit} className={styles.form}>
          <input type="hidden" name="id" value={story.id} />
          <label className={styles.field}>
            <span>Title</span>
            <input name="title" required maxLength={200} defaultValue={story.title} />
          </label>
          <label className={styles.field}>
            <span>Description</span>
            <textarea name="description" rows={3} maxLength={5000} defaultValue={story.description} />
          </label>
          {state.error && (
            <p className={styles.error} role="alert">
              {state.error}
            </p>
          )}
          <div className={styles.row}>
            <button type="submit" className={styles.secondary} disabled={saving}>
              {saving ? "Saving…" : "Save details"}
            </button>
            <button type="button" className={styles.danger} onClick={remove} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete story"}
            </button>
          </div>
          {deleteError && (
            <p className={styles.error} role="alert">
              {deleteError}
            </p>
          )}
        </form>

        <UploadDropzone section={section} storyId={story.id} />
        <AdminPhotoGrid photos={story.photos} />
      </div>
    </details>
  );
}
