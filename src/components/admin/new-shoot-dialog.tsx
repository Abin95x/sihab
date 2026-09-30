"use client";

import { useId, useRef, useState, useTransition, type SubmitEvent } from "react";
import { createStory } from "@/app/admin/actions";
import { useLightDismissFallback } from "@/components/use-light-dismiss";
import type { Section } from "@/lib/photos";
import { DESCRIPTION_MAX, readStoryFields, TITLE_MAX } from "@/lib/validation";
import styles from "./admin.module.css";
import { Field, focusFirstError, useFieldErrors } from "./field";
import { Spinner } from "./spinner";

export function NewShootDialog({ section }: { section: Section }) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const fields = useFieldErrors();
  useLightDismissFallback(dialogRef);

  function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setError(null);
    const checked = readStoryFields(formData);
    if (checked.fieldErrors) {
      fields.setErrors(checked.fieldErrors);
      focusFirstError(form, checked.fieldErrors);
      return;
    }
    startTransition(async () => {
      const result = await createStory({}, formData);
      if (result.fieldErrors) {
        fields.setErrors(result.fieldErrors);
        focusFirstError(form, result.fieldErrors);
        return;
      }
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
        onClose={() => {
          setError(null);
          fields.setErrors({});
        }}
      >
        {/* noValidate: our own messages replace the browser's bubbles, so every error looks the same. */}
        <form onSubmit={onSubmit} className={styles.form} noValidate>
          <h2 id={titleId} className={styles.cardTitle}>
            New shoot
          </h2>
          <input type="hidden" name="section" value={section} />
          <Field label="Title" error={fields.errors.title}>
            {(control) => (
              <input
                {...control}
                name="title"
                required
                maxLength={TITLE_MAX}
                placeholder="e.g. Magazine name — Story title"
                onInput={() => fields.clear("title")}
              />
            )}
          </Field>
          <Field label="Description (optional)" error={fields.errors.description}>
            {(control) => (
              <textarea
                {...control}
                name="description"
                rows={3}
                maxLength={DESCRIPTION_MAX}
                onInput={() => fields.clear("description")}
              />
            )}
          </Field>
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
