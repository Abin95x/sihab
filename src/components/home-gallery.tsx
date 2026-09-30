"use client";

import type { ReactNode } from "react";
import { LoadMore, useInfiniteList } from "@/components/infinite-list";
import { LightboxGroup, PhotoTrigger } from "@/components/lightbox";
import { Photo } from "@/components/photo";
import { pad2, type Page, type PhotoMeta } from "@/lib/photos";

const CARD_SIZES = "40vw";

type Props = {
  first: Page<PhotoMeta>;
  /** Shown once every photo has loaded, so it doesn't jump down as more photos arrive. */
  footer: ReactNode;
};

/** The homepage's two staggered columns of photos, loading more as the visitor scrolls. */
export function HomeGallery({ first, footer }: Props) {
  const { items, done, status, loadMore, sentinelRef } = useInfiniteList("home", first);
  const numbered = items.map((photo, index) => ({ photo, index }));
  const left = numbered.filter(({ index }) => index % 2 === 0);
  const right = numbered.filter(({ index }) => index % 2 === 1);

  return (
    <>
      <LightboxGroup photos={items} label="Homepage">
        <div className="home-gallery">
          <div className="home-col">
            {left.map((item) => (
              <Card key={item.photo.id} {...item} />
            ))}
          </div>
          <div className="home-col home-col--right">
            {right.map((item) => (
              <Card key={item.photo.id} {...item} />
            ))}
          </div>
        </div>
      </LightboxGroup>
      <LoadMore status={status} done={done} onRetry={loadMore} sentinelRef={sentinelRef} />
      {done && footer}
    </>
  );
}

function Card({ photo, index }: { photo: PhotoMeta; index: number }) {
  const number = pad2(index + 1);
  return (
    <figure className="card">
      <PhotoTrigger index={index} label={`Open photograph ${number}`}>
        <Photo photo={photo} alt={`Photograph ${number} by Sihab`} sizes={CARD_SIZES} priority={index === 0} />
      </PhotoTrigger>
      <figcaption className="card-number" aria-hidden="true">
        {number}
      </figcaption>
    </figure>
  );
}
