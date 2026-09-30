"use client";

import { LoadMore, useInfiniteList } from "@/components/infinite-list";
import { LightboxGroup, PhotoTrigger } from "@/components/lightbox";
import { Photo } from "@/components/photo";
import { StorySearch } from "@/components/story-search";
import { pad2, type Page, type Section, type StoryWithPhotos } from "@/lib/photos";

const HERO_SIZES = "(max-width: 672px) calc(100vw - 32px), (max-width: 970px) 640px, 66vw";
const GRID_SIZES = "(max-width: 640px) 50vw, (max-width: 970px) 214px, 22vw";

type Props = { title: string; section: Section; search: string; first: Page<StoryWithPhotos> };

/** A section's stories, with a search box. The first few come from the server; more load as the visitor scrolls. */
export function StoryList({ title, section, search, first }: Props) {
  return (
    <div className="section-page">
      <h1 className="section-title">{title}</h1>
      <StorySearch search={search} label={`Search ${title.toLowerCase()} stories`} />
      {/* Keyed by the search so a new query starts a fresh list, while the search box keeps its focus. */}
      <Stories key={search} section={section} search={search} first={first} />
    </div>
  );
}

function Stories({ section, search, first }: Omit<Props, "title">) {
  const { items, done, status, loadMore, sentinelRef } = useInfiniteList(section, first, search);
  return (
    <>
      {items.length === 0 ? (
        <p className="empty-state" role="status">
          {search ? <>No stories match &ldquo;{search}&rdquo;.</> : "New work coming soon."}
        </p>
      ) : (
        items.map((story, i) => <Story key={story.id} story={story} isFirst={i === 0} />)
      )}
      <LoadMore status={status} done={done} onRetry={loadMore} sentinelRef={sentinelRef} />
    </>
  );
}

function Story({ story, isFirst }: { story: StoryWithPhotos; isFirst: boolean }) {
  const [hero, ...rest] = story.photos;
  const alt = (i: number) => `${story.title} — photograph ${pad2(i + 1)}`;

  return (
    <article className="story">
      <h2 className="story-title">{story.title}</h2>
      <LightboxGroup photos={story.photos} label={story.title}>
        {hero && (
          <figure className="story-hero">
            <PhotoTrigger index={0} label={`Open ${alt(0)}`}>
              <Photo photo={hero} alt={alt(0)} sizes={HERO_SIZES} priority={isFirst} />
            </PhotoTrigger>
          </figure>
        )}
        {rest.length > 0 && (
          <div className="story-grid">
            {rest.map((photo, i) => (
              <figure key={photo.id}>
                <PhotoTrigger index={i + 1} label={`Open ${alt(i + 1)}`}>
                  <Photo photo={photo} alt={alt(i + 1)} sizes={GRID_SIZES} />
                </PhotoTrigger>
              </figure>
            ))}
          </div>
        )}
      </LightboxGroup>
      {story.description && <p className="story-text">{story.description}</p>}
    </article>
  );
}
