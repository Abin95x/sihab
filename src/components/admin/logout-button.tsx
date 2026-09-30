"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";
import { logout } from "@/app/admin/actions";
import { useLightDismissFallback } from "@/components/use-light-dismiss";
import styles from "./admin.module.css";

export function LogoutButton() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useLightDismissFallback(dialogRef);

  return (
    <>
      <button type="button" className={styles.logout} onClick={() => dialogRef.current?.showModal()}>
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
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
        </svg>
        Log out
      </button>

      <dialog
        ref={dialogRef}
        className={styles.confirmDialog}
        closedby="any"
        aria-labelledby="logout-title"
        aria-describedby="logout-body"
      >
        <h2 id="logout-title" className={styles.confirmTitle}>
          Log out?
        </h2>
        <p id="logout-body" className={styles.confirmBody}>
          You&rsquo;ll need to sign in again to edit the site.
        </p>
        <div className={styles.confirmActions}>
          <button type="button" className={styles.secondary} autoFocus onClick={() => dialogRef.current?.close()}>
            Cancel
          </button>
          <form action={logout}>
            <ConfirmButton />
          </form>
        </div>
      </dialog>
    </>
  );
}

function ConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={styles.primary} disabled={pending}>
      {pending ? "Logging out…" : "Log out"}
    </button>
  );
}
