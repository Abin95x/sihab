"use client";

import { useEffect, useRef } from "react";
import { createStory } from "@/app/admin/actions";
import type { StorySection } from "@/lib/photos";
import styles from "./admin.module.css";
import { useFormAction } from "./use-form-action";

export function NewStoryForm({ section }: { section: StorySection }) {
  const formRef = useRef<HTMLFormElement>(null);
  const { state, pending, onSubmit } = useFormAction(createStory);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} onSubmit={onSubmit} className={`${styles.form} ${styles.card}`}>
      <h2 className={styles.cardTitle}>New story</h2>
      <input type="hidden" name="section" value={section} />
      <label className={styles.field}>
        <span>Title</span>
<input name="title" required maxLength={200} placeholder="e.g. Magazine name — Story title" />
      </label>
      <label className={styles.field}>
        <span>Description (optional)</span>
        <textarea name="description" rows={3} maxLength={5000} />
      </label>
      {state.error && (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      )}
      <button type="submit" className={styles.primary} disabled={pending}>
        {pending ? "Creating…" : "Create story"}
      </button>
    </form>
  );
}
