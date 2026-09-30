"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useLightDismissFallback } from "@/components/use-light-dismiss";
import styles from "./admin.module.css";

type ConfirmOptions = {
  title: string;
  body?: string;
  /** Label of the confirm button, e.g. "Delete photo". */
  confirmLabel: string;
  /** Red confirm button for destructive actions. */
  danger?: boolean;
};

/**
 * A styled replacement for `window.confirm`. Render `dialog` somewhere in the component, then
 * `if (!(await confirm({ ... }))) return;`. Escape, a backdrop click or Cancel all resolve to false.
 */
export function useConfirm() {
  const titleId = useId();
  const bodyId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const resolveRef = useRef<((confirmed: boolean) => void) | null>(null);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  useLightDismissFallback(dialogRef);

  // Open once the dialog has rendered with the new text.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!options || !dialog || dialog.open) return;
    dialog.returnValue = "";
    dialog.showModal();
  }, [options]);

  const confirm = useCallback((next: ConfirmOptions) => {
    resolveRef.current?.(false);
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setOptions(next);
    });
  }, []);

  function onClose() {
    resolveRef.current?.(dialogRef.current?.returnValue === "confirm");
    resolveRef.current = null;
    setOptions(null);
  }

  const dialog = (
    <dialog
      ref={dialogRef}
      className={styles.confirmDialog}
      closedby="any"
      aria-labelledby={titleId}
      aria-describedby={options?.body ? bodyId : undefined}
      onClose={onClose}
    >
      {options && (
        <form method="dialog">
          <h2 id={titleId} className={styles.confirmTitle}>
            {options.title}
          </h2>
          {options.body && (
            <p id={bodyId} className={styles.confirmBody}>
              {options.body}
            </p>
          )}
          <div className={styles.confirmActions}>
            <button type="submit" value="cancel" className={styles.secondary} autoFocus>
              Cancel
            </button>
            <button
              type="submit"
              value="confirm"
              className={options.danger ? `${styles.primary} ${styles.primaryDanger}` : styles.primary}
            >
              {options.confirmLabel}
            </button>
          </div>
        </form>
      )}
    </dialog>
  );

  return { confirm, dialog };
}
