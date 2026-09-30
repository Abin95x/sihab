"use client";

import { useState } from "react";
import { login } from "@/app/admin/actions";
import styles from "./admin.module.css";
import { Spinner } from "./spinner";
import { useFormAction } from "./use-form-action";

export function LoginForm() {
  const { state, pending, onSubmit } = useFormAction(login);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form onSubmit={onSubmit} className={styles.form}>
      <label className={styles.field}>
        <span>Username</span>
        <input
          name="username"
          autoComplete="username"
          required
          maxLength={64}
          autoCapitalize="none"
          spellCheck={false}
        />
      </label>
      <label className={styles.field}>
        <span>Password</span>
        <span className={styles.passwordWrap}>
          <input
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            maxLength={256}
            autoCapitalize="none"
            spellCheck={false}
          />
          <button
            type="button"
            className={styles.reveal}
            onClick={() => setShowPassword((shown) => !shown)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            title={showPassword ? "Hide password" : "Show password"}
          >
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
              <circle cx="12" cy="12" r="3" />
              {showPassword && <path d="M4 4l16 16" />}
            </svg>
          </button>
        </span>
      </label>
      {state.error && (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      )}
      <button type="submit" className={styles.primary} disabled={pending}>
        {pending && <Spinner />}
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
