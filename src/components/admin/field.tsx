// Used only from client components (the admin forms), so it needs no "use client" of its own.
import { useCallback, useId, useState, type ReactNode } from "react";
import type { FieldErrors } from "@/lib/validation";
import styles from "./admin.module.css";

/** Props a Field passes to its input so the label and error message are wired up for screen readers. */
export type ControlProps = { id: string; "aria-invalid"?: true; "aria-describedby"?: string };

type FieldProps = {
  label: string;
  error?: string;
  /** Renders the input, given the props that connect it to the label and error. */
  children: (control: ControlProps) => ReactNode;
};

/** A labelled input with its validation message underneath; the input turns red while it has an error. */
export function Field({ label, error, children }: FieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": error ? errorId : undefined })}
      {error && (
        <p id={errorId} className={styles.fieldError}>
          {error}
        </p>
      )}
    </div>
  );
}

/** Per-field error state for a form. `clear(name)` is meant for the input's onInput, so errors go as you type. */
export function useFieldErrors() {
  const [errors, setErrors] = useState<FieldErrors>({});
  const clear = useCallback(
    (name: string) =>
      setErrors((current) => {
        if (!current[name]) return current;
        const next = { ...current };
        delete next[name];
        return next;
      }),
    [],
  );
  return { errors, setErrors, clear };
}

/** Moves focus to the first field with an error, once React has rendered its message. */
export function focusFirstError(form: HTMLFormElement, errors: FieldErrors) {
  const name = Object.keys(errors)[0];
  if (!name) return;
  requestAnimationFrame(() => {
    const control = form.elements.namedItem(name);
    if (control instanceof HTMLElement) control.focus();
  });
}
