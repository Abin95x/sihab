import { HomeGallery } from "@/components/home-gallery";
import { Marquee } from "@/components/marquee";
import { getHomePhotos } from "@/lib/data";
import { site } from "@/lib/site";

export default async function HomePage() {
  // Only the first slice is rendered here; the gallery loads the rest as the visitor scrolls.
  const first = await getHomePhotos();
  const bio = <p className="home-bio">{site.bio}</p>;

  return (
    <>
      <Marquee />
      <h1 className="visually-hidden">{site.title}</h1>

      {first.items.length === 0 ? (
        <>
          <p className="empty-state">Photographs coming soon.</p>
          {bio}
        </>
      ) : (
        <HomeGallery first={first} footer={bio} />
      )}
    </>
  );
}
