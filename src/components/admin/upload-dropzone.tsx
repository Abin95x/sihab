"use client";

import { useId, useRef, useState, useTransition } from "react";
import { uploadPhoto } from "@/app/admin/actions";
import type { Section } from "@/lib/photos";
import styles from "./admin.module.css";
import { prepareForUpload } from "./prepare-upload";

type Props = { section: Section; storyId?: string };

export function UploadDropzone({ section, storyId }: Props) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);

  function upload(list: FileList | null) {
    const files = Array.from(list ?? []).filter(
      (f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name),
    );
    if (files.length === 0 || pending) return;

    setErrors([]);
    setProgress({ done: 0, total: files.length });
    startTransition(async () => {
      const failed: string[] = [];
      for (const [i, file] of files.entries()) {
        try {
          const body = new FormData();
          body.set("section", section);
          if (storyId) body.set("storyId", storyId);
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
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  return (
    <div>
      <label
        htmlFor={inputId}
        className={styles.dropzone}
        data-dragging={dragging || undefined}
        data-busy={pending || undefined}
        onDragOver={(e) => {
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
          onChange={(e) => upload(e.currentTarget.files)}
        />
        <span className={styles.dropzoneTitle}>
          {progress ? `Uploading ${Math.min(progress.done + 1, progress.total)} of ${progress.total}…` : "Add photos"}
        </span>
        <span className={styles.hint}>
          {progress ? "Keep this page open until it finishes." : "Tap to choose, or drop images here. JPEG, PNG, WebP or AVIF."}
        </span>
        {progress && (
          <progress className={styles.progress} max={progress.total} value={progress.done} aria-label="Upload progress" />
        )}
      </label>
      {errors.length > 0 && (
        <ul className={styles.errorList} role="alert">
          {errors.map((message, i) => (
            <li key={i}>{message}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
