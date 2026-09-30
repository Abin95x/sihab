"use client";

import { closestCenter, DndContext, type DragEndEvent } from "@dnd-kit/core";
import { rectSortingStrategy, SortableContext } from "@dnd-kit/sortable";
import Link from "next/link";
import { useId, useOptimistic, useState, useTransition } from "react";
import { reorderStories } from "@/app/admin/actions";
import type { Section, StoryWithPhotos } from "@/lib/photos";
import styles from "./admin.module.css";
import { LinkPending } from "./link-pending";
import { movedIds, SavingOrder, sortByIds, useDragGuard, useSortableItem, useSortSensors } from "./sortable";

type Props = { section: Section; shoots: StoryWithPhotos[] };

/** Shoots shown as folders. Drag a folder to change the order of shoots on the site. */
export function ShootFolders({ section, shoots }: Props) {
  const dndId = useId();
  const sensors = useSortSensors();
  const dragGuard = useDragGuard();
  const [ordering, startOrdering] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [items, applyOrder] = useOptimistic(shoots, (state, order: string[]) => sortByIds(state, order));

  function onDragEnd(event: DragEndEvent) {
    dragGuard.end();
    const order = movedIds(
      items.map((s) => s.id),
      event,
    );
    if (!order) return;
    setError(null);
    startOrdering(async () => {
      applyOrder(order);
      const result = await reorderStories(section, order);
      if (result.error) setError(result.error);
    });
  }

  return (
    <>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <DndContext
        id={dndId}
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={dragGuard.start}
        onDragEnd={onDragEnd}
        onDragCancel={dragGuard.end}
      >
        <SortableContext items={items.map((s) => s.id)} strategy={rectSortingStrategy}>
          <ul className={styles.folders}>
            {items.map((shoot) => (
              <Folder key={shoot.id} section={section} shoot={shoot} dragGuard={dragGuard.ref} />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      {ordering && <SavingOrder />}
    </>
  );
}

type FolderProps = { section: Section; shoot: StoryWithPhotos; dragGuard: { current: boolean } };

function Folder({ section, shoot, dragGuard }: FolderProps) {
  const sortableProps = useSortableItem(shoot.id, dragGuard);
  const count = shoot.photos.length;
  const archived = shoot.photos.filter((p) => p.archived).length;

  return (
    <li {...sortableProps} className={styles.folderItem}>
      <Link
        href={`/admin?tab=${section}&shoot=${shoot.id}`}
        className={styles.folder}
        data-archived={shoot.archived || undefined}
        draggable={false}
      >
        <span className={styles.folderFrame} aria-hidden="true">
          <LinkPending size={18} />
        </span>
        <span className={styles.folderName}>{shoot.title}</span>
        <span className={styles.folderMeta}>
          {count} photo{count === 1 ? "" : "s"}
          {archived > 0 && ` · ${archived} archived`}
        </span>
      </Link>
    </li>
  );
}
