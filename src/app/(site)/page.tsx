import { LightboxGroup, PhotoTrigger } from "@/components/lightbox";
import { Marquee } from "@/components/marquee";
import { Photo } from "@/components/photo";
import { getHomePhotos } from "@/lib/data";
import { pad2, type PhotoMeta } from "@/lib/photos";
import { site } from "@/lib/site";

const CARD_SIZES = "40vw";

export default async function HomePage() {
  const photos = await getHomePhotos();
  const numbered = photos.map((photo, index) => ({ photo, index }));
  const left = numbered.filter(({ index }) => index % 2 === 0);
  const right = numbered.filter(({ index }) => index % 2 === 1);

  return (
    <>
      <Marquee />
      <h1 className="visually-hidden">{site.title}</h1>

      {photos.length === 0 ? (
        <p className="empty-state">Photographs coming soon.</p>
      ) : (
        <LightboxGroup photos={photos} label="Homepage">
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
      )}

      <p className="home-bio">{site.bio}</p>
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
