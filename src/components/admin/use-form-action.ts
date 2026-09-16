"use client";

import { startTransition, useActionState, type FormEvent } from "react";
import type { ActionResult } from "@/app/admin/actions";

type FormAction = (prev: ActionResult, formData: FormData) => Promise<ActionResult>;

/**
 * Like `useActionState`, but submits via `onSubmit` so React does not reset the form
 * afterwards — a failed submit keeps what the user typed.
 */
export function useFormAction(action: FormAction) {
  const [state, dispatch, pending] = useActionState(action, {});

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => dispatch(formData));
  };

  return { state, pending, onSubmit };
}
