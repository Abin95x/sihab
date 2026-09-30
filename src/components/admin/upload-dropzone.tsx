"use client";

import { useId, useRef, useState, useTransition } from "react";
import { uploadPhoto } from "@/app/admin/actions";
import type { Section } from "@/lib/photos";
import styles from "./admin.module.css";
import { prepareForUpload } from "./prepare-upload";
import { Spinner } from "./spinner";

type Progress = { done: number; total: number };

/** Uploads images one at a time into a story, tracking progress and collecting per-file errors. */
export function usePhotoUpload(section: Section, storyId: string) {
  const [pending, startTransition] = useTransition();
  const [progress, setProgress] = useState<Progress | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  function upload(list: FileList | null, onDone?: () => void) {
    const files = Array.from(list ?? []).filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name));
    if (files.length === 0 || pending) return;

    setErrors([]);
    setProgress({ done: 0, total: files.length });
    startTransition(async () => {
      const failed: string[] = [];
      for (const [i, file] of files.entries()) {
        try {
          const body = new FormData();
          body.set("section", section);
          body.set("storyId", storyId);
          body.set("file", await prepareForUpload(file), file.name);
          const result = await uploadPhoto(body);
          if (result.error) failed.push(result.error);
        } catch {
          failed.push(`${file.name}: upload failed. Check your connection and try again.`);
        }
        setProgress({ done: i + 1, total: files.length });
      }
      setErrors(failed);
      setProgress(null);
      onDone?.();
    });
  }

  return { upload, pending, progress, errors };
}

export type PhotoUpload = ReturnType<typeof usePhotoUpload>;

/** The "Add photos" card at the start of the photo grid: click to choose files, or drop them on it. */
export function AddPhotosTile({ uploader }: { uploader: PhotoUpload }) {
  const { upload, pending, progress } = uploader;
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const clearInput = () => {
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <li className={styles.addTile}>
      <label
        htmlFor={inputId}
        className={styles.addTileLabel}
        data-dragging={dragging || undefined}
        data-busy={pending || undefined}
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes("Files")) return;
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          upload(e.dataTransfer.files);
        }}
      >
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept="image/*"
          multiple
          disabled={pending}
          className="visually-hidden"
          onChange={(e) => upload(e.currentTarget.files, clearInput)}
        />
        {progress ? (
          <>
            <Spinner size={22} />
            <span className={styles.addTileTitle} aria-live="polite">
              Uploading {Math.min(progress.done + 1, progress.total)} of {progress.total}
            </span>
            <progress
              className={styles.progress}
              max={progress.total}
              value={progress.done}
              aria-label="Upload progress"
            />
            <span className={styles.addTileHint}>Keep this page open</span>
          </>
        ) : (
          <>
            <span className={styles.addTileIcon} aria-hidden="true">
              <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 5v14M5 12h14" strokeLinecap="round" />
              </svg>
            </span>
            <span className={styles.addTileTitle}>Add photos</span>
            <span className={styles.addTileHint}>Choose or drop images</span>
          </>
        )}
      </label>
    </li>
  );
}

/** Messages for files that failed to upload, shown above the grid. */
export function UploadErrors({ errors }: { errors: string[] }) {
  if (errors.length === 0) return null;
  return (
    <ul className={styles.errorList} role="alert">
      {errors.map((message, i) => (
        <li key={i}>{message}</li>
      ))}
    </ul>
  );
}
