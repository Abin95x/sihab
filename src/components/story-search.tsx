"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type SubmitEvent } from "react";
import { SEARCH_MAX } from "@/lib/validation";

const DEBOUNCE_MS = 300;

type Props = {
  /** The search the page was rendered with, from `?q=`. */
  search: string;
  label: string;
};

/**
 * Filters the stories as the visitor types by updating `?q=`, which the page reads on the server.
 * Without JavaScript it is a plain GET form with the same effect.
 */
export function StorySearch({ search, label }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [value, setValue] = useState(search);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Follow the URL when it changes some other way, such as the back button.
  const [shown, setShown] = useState(search);
  if (search !== shown) {
    setShown(search);
    setValue(search);
  }

  useEffect(() => () => clearTimeout(timer.current), []);

  const go = (next: string) => {
    clearTimeout(timer.current);
    const q = next.trim();
    if (q === search) return;
    const url = q ? `${pathname}?${new URLSearchParams({ q })}` : pathname;
    startTransition(() => router.replace(url, { scroll: false }));
  };

  const onChange = (next: string) => {
    setValue(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => go(next), DEBOUNCE_MS);
  };

  const clear = () => {
    setValue("");
    go("");
  };

  const onSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    go(value);
  };

  return (
    <form role="search" className="story-search" onSubmit={onSubmit} aria-busy={pending}>
      <svg viewBox="0 0 24 24" className="story-search-icon" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </svg>
      <input
        type="search"
        name="q"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape" && value) {
            event.preventDefault();
            clear();
          }
        }}
        placeholder="Search"
        aria-label={label}
        maxLength={SEARCH_MAX}
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="search"
      />
      {pending && <span className="story-search-spinner" aria-hidden="true" />}
      {value && !pending && (
        <button
          type="button"
          className="story-search-clear"
          aria-label="Clear search"
          onClick={clear}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      )}
    </form>
  );
}
