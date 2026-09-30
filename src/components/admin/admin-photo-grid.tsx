"use client";

import { closestCenter, DndContext, type DragEndEvent } from "@dnd-kit/core";
import { rectSortingStrategy, SortableContext } from "@dnd-kit/sortable";
import { useId, useOptimistic, useState, useTransition } from "react";
import { deletePhoto, reorderPhotos, setFeatured, setPhotoArchived } from "@/app/admin/actions";
import { pad2, photoUrl, type PhotoMeta } from "@/lib/photos";
import styles from "./admin.module.css";
import { movedIds, SavingOrder, sortByIds, useDragGuard, useSortableItem, useSortSensors } from "./sortable";
import { Spinner } from "./spinner";
import { useConfirm } from "./use-confirm";

type Busy = "archiving" | "restoring" | "deleting";
type Tile = PhotoMeta & { busy?: Busy };
type Change = { id: string; busy?: Busy; archived?: boolean; featured?: boolean } | { order: string[] };

/** Photos with star, archive and delete buttons. Pass `storyId` to allow drag-and-drop reordering. */
export function AdminPhotoGrid({ photos, storyId }: { photos: PhotoMeta[]; storyId?: string }) {
  const dndId = useId();
  const sensors = useSortSensors();
  const dragGuard = useDragGuard();
  const [, startTransition] = useTransition();
  const [ordering, startOrdering] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { confirm, dialog } = useConfirm();
  // While an action runs, its tile shows a spinner (and the new archived state or order). The optimistic
  // state falls back to the server's photos once the action and its revalidation finish.
  const [tiles, apply] = useOptimistic<Tile[], Change>(photos, (state, change) => {
    if ("order" in change) return sortByIds(state, change.order);
    const { id, busy, archived, featured } = change;
    return state.map((p) =>
      p.id === id ? { ...p, busy, archived: archived ?? p.archived, featured: featured ?? p.featured } : p,
    );
  });

  if (photos.length === 0) {
    return <p className={styles.empty}>No photos yet.</p>;
  }

  function onDragEnd(event: DragEndEvent) {
    dragGuard.end();
    const order = movedIds(
      tiles.map((p) => p.id),
      event,
    );
    if (!order || !storyId) return;
    setError(null);
    startOrdering(async () => {
      apply({ order });
      const result = await reorderPhotos(storyId, order);
      if (result.error) setError(result.error);
    });
  }

  async function remove(photo: Tile, number: string) {
    const confirmed = await confirm({
      title: `Delete photo ${number}?`,
      body: "This cannot be undone.",
      confirmLabel: "Delete photo",
      danger: true,
    });
    if (!confirmed) return;
    setError(null);
    startTransition(async () => {
      apply({ id: photo.id, busy: "deleting" });
      const result = await deletePhoto(photo.id);
      if (result.error) setError(result.error);
    });
  }

  function toggleArchived(photo: Tile) {
    const archived = !photo.archived;
    setError(null);
    startTransition(async () => {
      apply({ id: photo.id, busy: archived ? "archiving" : "restoring", archived });
      const result = await setPhotoArchived(photo.id, archived);
      if (result.error) setError(result.error);
    });
  }

  // Starring is quick and low-stakes, so the star flips straight away without the busy overlay.
  function toggleFeatured(photo: Tile) {
    const featured = !photo.featured;
    setError(null);
    startTransition(async () => {
      apply({ id: photo.id, featured });
      const result = await setFeatured(photo.id, featured);
      if (result.error) setError(result.error);
    });
  }

  return (
    <>
      {dialog}
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
        <SortableContext items={tiles.map((p) => p.id)} strategy={rectSortingStrategy} disabled={!storyId}>
          <ul className={styles.grid}>
            {tiles.map((photo, i) => (
              <PhotoTile
                key={photo.id}
                photo={photo}
                number={pad2(i + 1)}
                sortable={!!storyId}
                dragGuard={dragGuard.ref}
                onStar={() => toggleFeatured(photo)}
                onArchive={() => toggleArchived(photo)}
                onDelete={(number) => remove(photo, number)}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      {ordering && <SavingOrder />}
    </>
  );
}

type PhotoTileProps = {
  photo: Tile;
  number: string;
  sortable: boolean;
  dragGuard: { current: boolean };
  onStar: () => void;
  onArchive: () => void;
  onDelete: (number: string) => void;
};

function PhotoTile({ photo, number, sortable, dragGuard, onStar, onArchive, onDelete }: PhotoTileProps) {
  const sortableProps = useSortableItem(photo.id, dragGuard, !sortable || !!photo.busy);
  return (
    <li
      {...sortableProps}
      className={styles.tile}
      data-archived={photo.archived || undefined}
      data-busy={photo.busy || undefined}
      aria-busy={photo.busy ? true : undefined}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- served from the storage bucket */}
      <img src={photoUrl(photo, "thumb")} alt={`Photo ${number}`} loading="lazy" decoding="async" draggable={false} />
      <span className={styles.tileNumber}>
        {number}
        {photo.featured && (
          <svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor" role="img" aria-label="Starred">
            <path d={STAR} />
          </svg>
        )}
      </span>
      {photo.archived && <span className={styles.tileTag}>Archived</span>}
      {photo.busy && (
        <span className={styles.tileBusy}>
          <Spinner size={16} />
          {photo.busy === "deleting" ? "Deleting…" : photo.busy === "archiving" ? "Archiving…" : "Restoring…"}
        </span>
      )}
      <span className={styles.tileActions}>
        <IconButton
          label={photo.featured ? "Unstar" : "Star for homepage"}
          ariaLabel={`${photo.featured ? "Unstar" : "Star"} photo ${number}`}
          pressed={!!photo.featured}
          className={styles.tileStar}
          onClick={onStar}
        >
          <path d={STAR} fill={photo.featured ? "currentColor" : "none"} />
        </IconButton>
        <IconButton
          label={photo.archived ? "Restore" : "Archive"}
          ariaLabel={`${photo.archived ? "Restore" : "Archive"} photo ${number}`}
          onClick={onArchive}
        >
          {photo.archived ? (
            <path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5" />
          ) : (
            <path d="M3 4h18v4H3zM5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M10 12h4" />
          )}
        </IconButton>
        <IconButton
          label="Delete"
          ariaLabel={`Delete photo ${number}`}
          className={styles.tileDelete}
          onClick={() => onDelete(number)}
        >
          <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6M10 11v6M14 11v6" />
        </IconButton>
      </span>
    </li>
  );
}

const STAR = "M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z";

type IconButtonProps = {
  /** Shown in the hover tooltip. */
  label: string;
  /** Full accessible name, e.g. "Delete photo 03". */
  ariaLabel: string;
  pressed?: boolean;
  className?: string;
  onClick: () => void;
  children: React.ReactNode;
};

function IconButton({ label, ariaLabel, pressed, className, onClick, children }: IconButtonProps) {
  return (
    <button
      type="button"
      className={className ? `${styles.tileButton} ${className}` : styles.tileButton}
      data-tooltip={label}
      aria-label={ariaLabel}
      aria-pressed={pressed}
      onClick={onClick}
    >
      <svg
        viewBox="0 0 24 24"
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {children}
      </svg>
    </button>
  );
}
