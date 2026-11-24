export type GalleryPhoto = { slug: string; src: string; alt: string; className: string };

const FEATURED_PHOTOS = [
  ["1QLntPDP3APWNsB8KrIBxQQviJw1HhrNI", "horizontal"],
  ["1Bdu9igqhQq8et6p0hVsdvik544Rz1kjh", "horizontal"],
  ["1UtKNWLwlcGcx3xq--VFHUDOnyQ0gHUyB", "vertical"],
  ["1af_bdACIPjCgE4Ddm_sx0qC2t6zs_t51", "horizontal"],
  ["1I1p9TbQR47XybpHJ_JRnCS9VQkgWMVwN", "horizontal"],
  ["10OPydYZUHi-Lm9jThagyzqHcIlhVAvDe", "vertical"],
  ["1WanqOT1pyM5zGLjPEgBHk6GwGJF9pXhw", "horizontal"],
  ["1ULO9t8869MwHJVirv5YlDUopHTk0kQrR", "vertical"],
  ["1CStsaFioJgrqRPFSvZK6slx54DZopZxH", "horizontal"],
  ["1LWJkbikIbT-hTpvAzbA9txYUo2u1zRbI", "horizontal"],
  ["1g1YRtArryYqE1E039MTL3QpUvidIYPVS", "vertical"],
  ["1nICsaZbgPvEN7TyedrH_FeZxdZh-mPQI", "horizontal"],
  ["1fSMB0D8PGt33Gha5BisWwVbW1oMFirVw", "vertical"],
  ["1ox3a27hQnTudBN1UIQicC3j5wCh5liwO", "horizontal"],
  ["1yokTMBch4XkM32yl0lViJMkZ7uHgAVjP", "horizontal"],
  ["1f8GFZlQ0KceqXdmTJuOziup_rIBOfuA-", "vertical"],
  ["1m71x_BoHo3ZO14lATxQpdSwgex4WefAr", "horizontal"],
  ["1LWZjPUyOa320McYCeWOE8oeI7UDYQO7z", "vertical"],
  ["1gf6G34MWhbgMSlF5f4dz6I3R9LMlzGd2", "horizontal"],
  ["1u9eRHenIS4jW7fwzCAM-eshfexb-0b_z", "vertical"],
] as const;

export const GALLERY_PHOTOS: GalleryPhoto[] = FEATURED_PHOTOS.map(([id, orientation], index) => ({
  slug: `culto-de-domingo-22-11-foto-${String(index + 1).padStart(2, "0")}`,
  src: `https://lh3.googleusercontent.com/d/${id}=w1400`,
  alt: `Momento do Culto de Domingo na Casa em 22 de novembro — foto ${String(index + 1).padStart(2, "0")}`,
  className: orientation === "vertical" ? "home-gallery-tall" : "home-gallery-wide",
}));

export function getGalleryPhoto(slug: string) { return GALLERY_PHOTOS.find(photo => photo.slug === slug); }
export function getPhotoHref(slug: string) { return `/fotos/${slug}`; }
