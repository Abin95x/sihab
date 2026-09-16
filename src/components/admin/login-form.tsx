"use client";

import { login } from "@/app/admin/actions";
import styles from "./admin.module.css";
import { useFormAction } from "./use-form-action";

export function LoginForm() {
  const { state, pending, onSubmit } = useFormAction(login);

  return (
    <form onSubmit={onSubmit} className={styles.form}>
      <label className={styles.field}>
        <span>Username</span>
<input name="username" autoComplete="username" required autoCapitalize="none" spellCheck={false} />
      </label>
      <label className={styles.field}>
        <span>Password</span>
        <input name="password" type="password" autoComplete="current-password" required />
      </label>
      {state.error && (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      )}
      <button type="submit" className={styles.primary} disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
