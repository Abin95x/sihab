"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useLightDismissFallback } from "@/components/use-light-dismiss";
import { pad2, photoSrcSet, photoUrl, type PhotoMeta } from "@/lib/photos";

const LightboxContext = createContext<((index: number) => void) | null>(null);

type GroupProps = {
  photos: PhotoMeta[];
  /** Used for the dialog name and image alt text, e.g. "Homepage" or a story title. */
  label: string;
  children: ReactNode;
};

/** Wraps a set of photos; any `PhotoTrigger` inside opens the viewer at its index. */
export function LightboxGroup({ photos, label, children }: GroupProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const touchStartX = useRef<number | null>(null);
  const [index, setIndex] = useState(0);
  useLightDismissFallback(dialogRef);

  const count = photos.length;
  const current = photos[Math.min(index, count - 1)];

  const open = useCallback((i: number) => {
    setIndex(i);
    dialogRef.current?.showModal();
  }, []);

  const step = useCallback((delta: number) => setIndex((i) => (i + delta + count) % count), [count]);

  // Warm up the neighbouring full-size images.
  useEffect(() => {
    if (!dialogRef.current?.open || count < 2) return;
    for (const p of [photos[(index + 1) % count], photos[(index - 1 + count) % count]]) {
      new Image().src = photoUrl(p, "full");
    }
  }, [index, photos, count]);

  return (
    <LightboxContext.Provider value={open}>
      {children}
      <dialog
        ref={dialogRef}
        className="lightbox"
        closedby="any"
        aria-label={`${label} — photo viewer`}
        onClick={(e) => {
          // The dialog covers the viewport, so clicks around the photo land on the dialog itself.
          if (e.target === e.currentTarget) dialogRef.current?.close();
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") step(1);
          if (e.key === "ArrowLeft") step(-1);
        }}
      >
        <div
          className="lightbox-stage"
          onTouchStart={(e) => {
            touchStartX.current = e.touches[0].clientX;
          }}
          onTouchEnd={(e) => {
            if (touchStartX.current === null) return;
            const dx = e.changedTouches[0].clientX - touchStartX.current;
            touchStartX.current = null;
            if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
          }}
        >
          {current && (
            // eslint-disable-next-line @next/next/no-img-element -- served from the photo API with its own srcset
            <img
              key={current.id}
              className="lightbox-img"
              src={photoUrl(current, "full")}
              srcSet={photoSrcSet(current)}
              sizes="100vw"
              width={current.width}
              height={current.height}
              alt={`${label} — photograph ${pad2(index + 1)}`}
            />
          )}
        </div>
        <button
          type="button"
          className="menu-toggle lightbox-close"
          aria-label="Close"
          onClick={() => dialogRef.current?.close()}
        >
          <span className="plus is-x" aria-hidden="true" />
        </button>
        <div className="lightbox-bar">
          {count > 1 ? (
            <button type="button" className="lightbox-nav" onClick={() => step(-1)}>
              Prev
            </button>
          ) : (
            <span />
          )}
          <p className="lightbox-count" aria-live="polite">
            {pad2(index + 1)} / {pad2(count)}
          </p>
          {count > 1 ? (
            <button type="button" className="lightbox-nav" onClick={() => step(1)}>
              Next
            </button>
          ) : (
            <span />
          )}
        </div>
      </dialog>
    </LightboxContext.Provider>
  );
}

export function PhotoTrigger({ index, label, children }: { index: number; label: string; children: ReactNode }) {
  const open = useContext(LightboxContext);
  return (
    <button type="button" className="photo-button" aria-label={label} onClick={() => open?.(index)}>
      {children}
    </button>
  );
}
