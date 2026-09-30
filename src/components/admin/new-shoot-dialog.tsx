"use client";

import { useId, useRef, useState, useTransition, type SubmitEvent } from "react";
import { createStory } from "@/app/admin/actions";
import { useLightDismissFallback } from "@/components/use-light-dismiss";
import type { Section } from "@/lib/photos";
import styles from "./admin.module.css";
import { Spinner } from "./spinner";

export function NewShootDialog({ section }: { section: Section }) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  useLightDismissFallback(dialogRef);

  function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setError(null);
    startTransition(async () => {
      const result = await createStory({}, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      // The action revalidates /admin, so the new folder appears in the list behind the dialog.
      form.reset();
      dialogRef.current?.close();
    });
  }

  return (
    <>
      <button type="button" className={styles.primary} onClick={() => dialogRef.current?.showModal()}>
        New shoot
      </button>
      <dialog
        ref={dialogRef}
        className={styles.dialog}
        aria-labelledby={titleId}
        closedby="any"
        onClose={() => setError(null)}
      >
        <form onSubmit={onSubmit} className={styles.form}>
          <h2 id={titleId} className={styles.cardTitle}>
            New shoot
          </h2>
          <input type="hidden" name="section" value={section} />
          <label className={styles.field}>
            <span>Title</span>
            <input name="title" required maxLength={200} placeholder="e.g. Magazine name — Story title" />
          </label>
          <label className={styles.field}>
            <span>Description (optional)</span>
            <textarea name="description" rows={3} maxLength={5000} />
          </label>
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
          <div className={styles.row}>
            <button type="submit" className={styles.primary} disabled={pending}>
              {pending && <Spinner />}
              {pending ? "Creating…" : "Create"}
            </button>
            <button
              type="button"
              className={styles.secondary}
              onClick={() => dialogRef.current?.close()}
              disabled={pending}
            >
              Cancel
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
