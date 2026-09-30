"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type Direction = "down" | "up";

/**
 * Floating button in the bottom-left corner. In the top half of a page it jumps to the bottom; in the bottom
 * half it jumps back to the top. Hidden on pages too short to scroll.
 */
export function ScrollButton() {
  const pathname = usePathname();
  const [direction, setDirection] = useState<Direction | null>(null);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const { scrollHeight } = document.documentElement;
        const room = scrollHeight - window.innerHeight;
        if (room < 200) setDirection(null);
        else setDirection(window.scrollY < room / 2 ? "down" : "up");
      });
    };
    update();
    // Content height changes as photos load, so watch the page size as well as scrolling.
    const resize = new ResizeObserver(update);
    resize.observe(document.body);
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [pathname]);

  function scroll() {
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({
      top: direction === "down" ? document.documentElement.scrollHeight : 0,
      behavior: smooth ? "smooth" : "auto",
    });
  }

  const label = direction === "up" ? "Back to top" : "Scroll to bottom";

  return (
    <button
      type="button"
      className="scroll-button"
      data-direction={direction ?? undefined}
      hidden={!direction}
      aria-label={label}
      title={label}
      onClick={scroll}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <path d="M12 5v14M6 13l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
