"use client";

import { useState, useTransition, type SubmitEvent } from "react";
import { login } from "@/app/admin/actions";
import { loginFieldErrors } from "@/lib/validation";
import styles from "./admin.module.css";
import { Field, focusFirstError, useFieldErrors } from "./field";
import { Spinner } from "./spinner";

export function LoginForm() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const fields = useFieldErrors();

  function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setError(null);
    const empty = loginFieldErrors(formData);
    if (empty) {
      fields.setErrors(empty);
      focusFirstError(form, empty);
      return;
    }
    // On success the action redirects to /admin; otherwise it returns a message.
    startTransition(async () => {
      const result = await login({}, formData);
      if (result.fieldErrors) {
        fields.setErrors(result.fieldErrors);
        focusFirstError(form, result.fieldErrors);
      }
      if (result.error) setError(result.error);
    });
  }

  return (
    <form onSubmit={onSubmit} className={styles.form} noValidate>
      <Field label="Username" error={fields.errors.username}>
        {(control) => (
          <input
            {...control}
            name="username"
            autoComplete="username"
            required
            maxLength={64}
            autoCapitalize="none"
            spellCheck={false}
            onInput={() => fields.clear("username")}
          />
        )}
      </Field>
      <Field label="Password" error={fields.errors.password}>
        {(control) => (
          <span className={styles.passwordWrap}>
            <input
              {...control}
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              maxLength={256}
              autoCapitalize="none"
              spellCheck={false}
              onInput={() => fields.clear("password")}
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
        )}
      </Field>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <button type="submit" className={styles.primary} disabled={pending}>
        {pending && <Spinner />}
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
