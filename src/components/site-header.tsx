"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { useLightDismissFallback } from "@/components/use-light-dismiss";
import { navItems, site } from "@/lib/site";

export function SiteHeader() {
  const pathname = usePathname();
  const menuRef = useRef<HTMLDialogElement>(null);
  useLightDismissFallback(menuRef);

  useEffect(() => {
    menuRef.current?.close();
  }, [pathname]);

  const close = () => menuRef.current?.close();

  return (
    <>
      <header className="site-header">
        <Link href="/" className="site-name">
          {site.name}
        </Link>
        <button
          type="button"
          className="menu-toggle"
          aria-label="Open menu"
          aria-haspopup="dialog"
          onClick={() => menuRef.current?.showModal()}
        >
          <span className="plus" aria-hidden="true" />
        </button>
      </header>

      <dialog ref={menuRef} className="site-menu" closedby="any" aria-label="Site menu">
        <button type="button" className="menu-toggle" aria-label="Close menu" onClick={close}>
          <span className="plus is-x" aria-hidden="true" />
        </button>
        <nav>
          <ul>
            {navItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={pathname === item.href ? "page" : undefined}
                  onClick={close}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </dialog>
    </>
  );
}
