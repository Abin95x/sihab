import { photoSrcSet, photoUrl, type PhotoMeta } from "@/lib/photos";

type Props = {
  photo: PhotoMeta;
  alt: string;
  sizes: string;
  /** The likely LCP image: loaded eagerly at high priority. */
  priority?: boolean;
};

export function Photo({ photo, alt, sizes, priority = false }: Props) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- served from the photo API with its own srcset
    <img
      src={photoUrl(photo, "thumb")}
      srcSet={photoSrcSet(photo)}
      sizes={sizes}
      width={photo.width}
      height={photo.height}
      alt={alt}
      loading={priority ? undefined : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      decoding="async"
    />
  );
}
