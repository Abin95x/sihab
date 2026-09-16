// Demo content shown on the public pages until a database is connected.
// The same photos can be copied into the database with `npm run db:seed`.
import content from "./demo-content.json";
import type { PhotoMeta, StorySection, StoryWithPhotos } from "./photos";

type DemoPhoto = (typeof content.home)[number];

function toPhoto(photo: DemoPhoto): PhotoMeta {
  return {
    id: `demo-${photo.file.replace(/\.\w+$/, "")}`,
    width: photo.width,
    height: photo.height,
    src: `/demo/${photo.file}`,
  };
}

export const demoHomePhotos: PhotoMeta[] = content.home.map(toPhoto);

export const demoStories: Record<StorySection, StoryWithPhotos[]> = {
  editorial: content.editorial.map((story, i) => ({
    id: `demo-editorial-${i + 1}`,
    title: story.title,
    description: story.description,
    photos: story.photos.map(toPhoto),
  })),
  commercial: content.commercial.map((story, i) => ({
    id: `demo-commercial-${i + 1}`,
    title: story.title,
    description: story.description,
    photos: story.photos.map(toPhoto),
  })),
};
