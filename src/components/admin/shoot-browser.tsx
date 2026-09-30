"use client";

import { useDeferredValue, useId, useState } from "react";
import type { Section, StoryWithPhotos } from "@/lib/photos";
import styles from "./admin.module.css";
import { ShootFolders } from "./shoot-folders";

type Props = { section: Section; shoots: StoryWithPhotos[] };

/** Lower-cased and stripped of accents, so "jose" finds "José". */
function fold(text: string) {
  return text.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
}

/**
 * A section's shoot folders with a search box. Every shoot is already loaded, so the search filters
 * in the browser by title and description. Archived shoots are listed separately below the active ones.
 */
export function ShootBrowser({ section, shoots }: Props) {
  const inputId = useId();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const needle = fold(deferredQuery.trim());

  const matches = needle ? shoots.filter((s) => fold(`${s.title}\n${s.description}`).includes(needle)) : shoots;
  const live = matches.filter((s) => !s.archived);
  const archived = matches.filter((s) => s.archived);
  const hasArchived = shoots.some((s) => s.archived);

  if (shoots.length === 0) return <p className={styles.empty}>No shoots yet.</p>;

  return (
    <>
      <div className={styles.search} role="search">
        <label htmlFor={inputId} className="visually-hidden">
          Search shoots
        </label>
        <svg viewBox="0 0 24 24" className={styles.searchIcon} aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-4-4" />
        </svg>
        <input
          id={inputId}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape" && query) {
              event.preventDefault();
              setQuery("");
            }
          }}
          placeholder="Search shoots"
          maxLength={100}
          autoComplete="off"
          spellCheck={false}
        />
        {query && (
          <button type="button" className={styles.searchClear} onClick={() => setQuery("")} aria-label="Clear search">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        )}
      </div>
      <p className="visually-hidden" role="status">
        {needle ? `${matches.length} shoot${matches.length === 1 ? "" : "s"} found` : ""}
      </p>

      {needle && matches.length === 0 ? (
        <p className={styles.empty}>No shoots match &ldquo;{deferredQuery.trim()}&rdquo;.</p>
      ) : live.length > 0 ? (
        <ShootFolders section={section} shoots={live} reorderable={!needle} />
      ) : (
        !needle && <p className={styles.empty}>{hasArchived ? "No active shoots." : "No shoots yet."}</p>
      )}

      {archived.length > 0 && (
        <section className={styles.archive} aria-labelledby="archived-shoots">
          <h2 id="archived-shoots" className={styles.subhead}>
            Archived · hidden from the site
          </h2>
          <ShootFolders section={section} shoots={archived} reorderable={!needle} />
        </section>
      )}
    </>
  );
}
