export type GalleryPhoto = { slug: string; src: string; alt: string; className: string };

const FEATURED_PHOTOS = [
  ["1LsoOlXLDthiVtw3Tr40hsGRE9poOD4Qo", "horizontal"],
  ["1FkCtB_dkAinT1rmurR5wEvwoacuCx8lF", "vertical"],
  ["19sySO3Je0GNOgvk9tVsIAX6_cZk8s_68", "horizontal"],
  ["1NzW3th8ZfoTFtsJ8fT7gX81jpFGuOmy0", "vertical"],
  ["1Ko5MCJb-f3f2br01qTOMCG5Rvoqvs-IV", "horizontal"],
  ["1gk7Y1dthnDxUb4BEeJmzGOwGmMhdEIUG", "vertical"],
  ["1Dexo_4zrMRG6dt91Eqrz4Avahe6aQvLZ", "horizontal"],
  ["1gJWlZ1AItyvZNo6U5X_D_eljzNG9oDwG", "vertical"],
  ["1TQx5JygGI8Q5h9Qgw29lpf2jP_qcKHHw", "horizontal"],
  ["1MbUNe4Tbe5ID9GF6rV3D0qzlm4NCjw_Q", "vertical"],
  ["1nB1m0o2k4GMoxBAVulPtpsG9FT0yuWGz", "horizontal"],
  ["1uzG8O01T8iYS0j1kQPDB_oq_KyRZSzwN", "vertical"],
  ["1NytLpfdH7tKtfm25gxlXUahuu6KSm0sV", "horizontal"],
  ["1n067S4MADYDhXpjE3SksKuFiGErpUOjF", "vertical"],
  ["1gNhJxFD3V8jhFWtYONEUA21-UF30aHI6", "horizontal"],
  ["10r_TLjbWB4s0bS9XuDwxJOpGglu4Ka6j", "vertical"],
  ["18asmV37rt2p8mCgKlvDsXMmLGKa99wzD", "horizontal"],
  ["1AZ7z3T5msM9s-c-7b6tUNvVYreuj1ggq", "vertical"],
  ["1lCmxKXTVE42LssDF_6JkaWXbUT8Reabi", "vertical"],
  ["125eAY7EM-yObFF6YnEft6E3zUc3rOCQm", "vertical"],
] as const;

export const GALLERY_PHOTOS: GalleryPhoto[] = FEATURED_PHOTOS.map(([id, orientation], index) => ({
  slug: `culto-de-domingo-01-11-foto-${String(index + 1).padStart(2, "0")}`,
  src: `https://lh3.googleusercontent.com/d/${id}=w1400`,
  alt: `Momento do Culto de Domingo na Casa em 1º de novembro — foto ${String(index + 1).padStart(2, "0")}`,
  className: orientation === "vertical" ? "home-gallery-tall" : "home-gallery-wide",
}));

export function getGalleryPhoto(slug: string) { return GALLERY_PHOTOS.find(photo => photo.slug === slug); }
export function getPhotoHref(slug: string) { return `/fotos/${slug}`; }
