"use client";

import { useLinkStatus } from "next/link";
import { Spinner } from "./spinner";

/** Inside a `<Link>`: shows a spinner in place of `children` (usually an icon) while the link's page loads. */
export function LinkPending({ children = null, size = 14 }: { children?: React.ReactNode; size?: number }) {
  const { pending } = useLinkStatus();
  return pending ? <Spinner size={size} /> : children;
}
