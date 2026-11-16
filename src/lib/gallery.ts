export type GalleryPhoto = { slug: string; src: string; alt: string; className: string };

const FEATURED_PHOTOS = [
  ["1I1uLJgez0x87rSKZmbiVNIyWAoVQ_4Z2", "horizontal"],
  ["1zQmYiDZD9GftZXlJ8OcV9sOP9sNwymuR", "vertical"],
  ["1eVriv5eTCRJ7FzqDZnI89kDZ3pC1PRSa", "horizontal"],
  ["11yA1GE_g32luv-odKRb3qZbDgXCiJfeN", "vertical"],
  ["1AyD0gBrAgD3hg1ud-IuyUBY9Tnq_LTor", "horizontal"],
  ["1GfFa7WT1zpfBgWp2eg1lkNSO_f7871py", "horizontal"],
  ["1Aw7DvVlZ3_dCXOnVqs-bvLrsuW84MIZF", "horizontal"],
  ["1OZ9KK79PRkKduc8sIxQj5xpZ4vhILs95", "vertical"],
  ["1Qr778WXvpx_R-aVjgOHF-CwduOsGx_CV", "horizontal"],
  ["1hEm4zz4WUdjE48xFmuxGeyCCuiuiWj4O", "vertical"],
  ["1MKQ31HQO7_pIcxmCO82CSQycKZ7svSnB", "horizontal"],
  ["1YnN0ow0AOV5ziH0vaRgv__noV67cm282", "horizontal"],
  ["1PjzWkMZDjcLuiM5uJfyXxQ9lZQzClJgY", "vertical"],
  ["1XXlra1UVXGjtDEaGIyt1ec7PVEE03glK", "horizontal"],
  ["1cAyzK9Y-H43Fpyrt7c8wqfaS2n-_bZ9I", "vertical"],
  ["1RQuv_xcIWGl14PjSZao3lSuXzk_PaRzB", "horizontal"],
  ["1sNVZz11tdydV0jA48lmrTbV8JuPGw-ne", "vertical"],
  ["1CP9aXcYB_dxckJZPBeXUZ2LHHoZlT0P9", "horizontal"],
  ["1n5zgD6e_5ylyg6lxwIT807dToTXt_bcH", "vertical"],
  ["1MOO9xd4uXmjeQYhJvStKaqQ_rzwAApz6", "horizontal"],
] as const;

export const GALLERY_PHOTOS: GalleryPhoto[] = FEATURED_PHOTOS.map(([id, orientation], index) => ({
  slug: `culto-de-domingo-15-11-foto-${String(index + 1).padStart(2, "0")}`,
  src: `https://lh3.googleusercontent.com/d/${id}=w1400`,
  alt: `Momento do Culto de Domingo na Casa em 15 de novembro — foto ${String(index + 1).padStart(2, "0")}`,
  className: orientation === "vertical" ? "home-gallery-tall" : "home-gallery-wide",
}));

export function getGalleryPhoto(slug: string) { return GALLERY_PHOTOS.find(photo => photo.slug === slug); }
export function getPhotoHref(slug: string) { return `/fotos/${slug}`; }
