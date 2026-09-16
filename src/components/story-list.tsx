import { LightboxGroup, PhotoTrigger } from "@/components/lightbox";
import { Photo } from "@/components/photo";
import { pad2, type StoryWithPhotos } from "@/lib/photos";

const HERO_SIZES = "(max-width: 672px) calc(100vw - 32px), (max-width: 970px) 640px, 66vw";
const GRID_SIZES = "(max-width: 640px) 50vw, (max-width: 970px) 214px, 22vw";

export function StoryList({ title, stories }: { title: string; stories: StoryWithPhotos[] }) {
  return (
    <div className="section-page">
      <h1 className="section-title">{title}</h1>
      {stories.length === 0 ? (
        <p className="empty-state">New work coming soon.</p>
      ) : (
        stories.map((story, i) => <Story key={story.id} story={story} isFirst={i === 0} />)
      )}
    </div>
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
