// Used only from client components (home-gallery, story-list), so it needs no "use client" of its own.
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { Page } from "@/lib/photos";

type Status = "idle" | "loading" | "error";

/**
 * Infinite scroll for a public list. Starts from the server-rendered first page and fetches the next one
 * from /api/more when `sentinelRef` comes within 800px of the viewport, until the list runs out.
 * `search` filters the list; pass the same one the server rendered the first page with.
 */
export function useInfiniteList<T extends { id: string }>(list: string, first: Page<T>, search = "") {
  const [items, setItems] = useState(first.items);
  const [nextOffset, setNextOffset] = useState(first.nextOffset);
  const [status, setStatus] = useState<Status>("idle");
  const inFlight = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadMore = useCallback(async () => {
    if (inFlight.current || nextOffset === null) return;
    inFlight.current = true;
    setStatus("loading");
    try {
      const params = new URLSearchParams({ list, offset: String(nextOffset) });
      if (search) params.set("q", search);
      const response = await fetch(`/api/more?${params}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const page: Page<T> = await response.json();
      // If the list changed between requests, skip anything already shown.
      setItems((shown) => {
        const seen = new Set(shown.map((item) => item.id));
        return [...shown, ...page.items.filter((item) => !seen.has(item.id))];
      });
      setNextOffset(page.nextOffset);
      setStatus("idle");
    } catch {
      setStatus("error");
    } finally {
      inFlight.current = false;
    }
  }, [list, nextOffset, search]);

  // Re-observing after each page means a sentinel that is still on screen (a short page) loads the next one too.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || nextOffset === null || status !== "idle") return;
    const observer = new IntersectionObserver((entries) => entries[0]?.isIntersecting && loadMore(), {
      rootMargin: "0px 0px 800px 0px",
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore, nextOffset, status]);

  return { items, done: nextOffset === null, status, loadMore, sentinelRef };
}

type LoadMoreProps = { status: Status; done: boolean; onRetry: () => void; sentinelRef: RefObject<HTMLDivElement | null> };

/** Invisible trigger at the end of the list; shows a spinner while loading and a retry button on failure. */
export function LoadMore({ status, done, onRetry, sentinelRef }: LoadMoreProps) {
  if (done) return null;
  return (
    <div ref={sentinelRef} className="load-more" aria-live="polite">
      {status === "loading" && (
        <>
          <span className="load-more-spinner" aria-hidden="true" />
          <span className="visually-hidden">Loading more photographs</span>
        </>
      )}
      {status === "error" && (
        <button type="button" className="load-more-retry" onClick={onRetry}>
          Couldn&rsquo;t load more. Try again
        </button>
      )}
    </div>
  );
}
