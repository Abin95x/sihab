"use client";

import {
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useCallback, useRef, type MouseEvent } from "react";
import styles from "./admin.module.css";
import { Spinner } from "./spinner";

// Shared drag-and-drop setup for the shoot folders and the photo grid.

/**
 * Mouse drags start after 6px so clicks still work; touch drags start after a short press so the page
 * can still scroll; keyboard users focus an item and press Space, then the arrow keys.
 */
export function useSortSensors() {
  return useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
}

/**
 * Tracks whether a drag is in progress, so the click that ends a drag doesn't also open a link or press a
 * button. Pass `start` and `end` to the DndContext and `ref` to each sortable item.
 */
export function useDragGuard() {
  const ref = useRef(false);
  const start = useCallback(() => {
    ref.current = true;
  }, []);
  // The click fires right after the drop, so clear the flag on the next task.
  const end = useCallback(() => {
    setTimeout(() => {
      ref.current = false;
    });
  }, []);
  return { ref, start, end };
}

/** The new order of `ids` after a drop, or null when nothing moved. */
export function movedIds(ids: string[], { active, over }: DragEndEvent): string[] | null {
  if (!over || active.id === over.id) return null;
  const from = ids.indexOf(String(active.id));
  const to = ids.indexOf(String(over.id));
  if (from < 0 || to < 0) return null;
  return arrayMove(ids, from, to);
}

/** `items` sorted to follow `ids`; items missing from `ids` go last. */
export function sortByIds<T extends { id: string }>(items: T[], ids: string[]): T[] {
  const position = new Map(ids.map((id, i) => [id, i]));
  return [...items].sort((a, b) => (position.get(a.id) ?? ids.length) - (position.get(b.id) ?? ids.length));
}

/** Props that make a list item draggable. The item itself is the keyboard handle, so links and buttons inside keep working. */
export function useSortableItem(id: string, dragGuard: { current: boolean }, disabled = false) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
    attributes: { role: "listitem" },
  });
  const ref = useCallback(
    (node: HTMLElement | null) => {
      setNodeRef(node);
      setActivatorNodeRef(node);
    },
    [setNodeRef, setActivatorNodeRef],
  );

  if (disabled) return { ref };
  return {
    ref,
    style: { transform: CSS.Translate.toString(transform), transition },
    "data-dragging": isDragging || undefined,
    ...attributes,
    ...listeners,
    onClickCapture: (event: MouseEvent) => {
      if (!dragGuard.current) return;
      event.preventDefault();
      event.stopPropagation();
    },
  };
}

/** Floating "Saving order…" message shown while a new order is saved. */
export function SavingOrder() {
  return (
    <p className={styles.toast} role="status">
      <Spinner />
      Saving order…
    </p>
  );
}
