export type GalleryPhoto = { slug: string; src: string; alt: string; className: string };

const FEATURED_PHOTOS = [
  [
    "16-yYmGC-c5kQtp_dDKScZXRfhfu604bY",
    "horizontal"
  ],
  [
    "13B9sCgO1lZT31RtNbPeuPqp3JYMiLFb_",
    "vertical"
  ],
  [
    "1XFdQVZkpEgPtprbftUVKiuLVKfCb5JCP",
    "horizontal"
  ],
  [
    "14Ar-bJmSHBoTYrjDsMdurg-VhBDLbfEV",
    "vertical"
  ],
  [
    "1fBp3IstxIxvkztEeB3_3GJePupc7Qpaa",
    "horizontal"
  ],
  [
    "1m-gjlu6acBrwjnYYLQxa3IvglfeKDXLK",
    "vertical"
  ],
  [
    "1akv9aNJdoAatYyx20-Cau3YPtVMUojTj",
    "horizontal"
  ],
  [
    "1p-GUEoML3JQ90K9Vlx5VIJWBEdupBjsV",
    "vertical"
  ],
  [
    "11OxykEv7C1ICcDqhz8a9-vJKdrycTnIk",
    "horizontal"
  ],
  [
    "1cwrT2ACku_2FPWh2Ulczl2k7n-vJbwS5",
    "vertical"
  ],
  [
    "1DA0Epymz1cgn7tMx8rAIuE6Ry8dcU6Jk",
    "horizontal"
  ],
  [
    "13CwhK2A0s6o94XNZAYAee1tHKaGjdycE",
    "vertical"
  ],
  [
    "1Z_TJhKa9LAb8HZggWzAQp-78kLCjWA9e",
    "horizontal"
  ],
  [
    "1VDjVplHx6LuKUTswgSk9pUI4UL_lvXlc",
    "vertical"
  ],
  [
    "1r3Qtuqtq3oqnK9XY37Q7Kd7s0qEAew2S",
    "horizontal"
  ],
  [
    "1Hud4pFdooq7f3vvk7_9hxjo2BwYhs_rp",
    "vertical"
  ],
  [
    "1aiLUCzz7sDKmUW7CVGKTzDcH2cJ0SBUS",
    "horizontal"
  ],
  [
    "1-vvDk8uV1o2xLiFNC3WNfE1jcuDpty3P",
    "vertical"
  ],
  [
    "1-eHZs365xevg_pUkswbSGbvEl7Of50qE",
    "vertical"
  ],
  [
    "1MveofNhiwBYqZp0gP1EtaohdOwYVvq9I",
    "vertical"
  ]
] as const;

export const GALLERY_PHOTOS: GalleryPhoto[] = FEATURED_PHOTOS.map(([id, orientation], index) => ({
  slug: `culto-de-domingo-18-10-foto-${String(index + 1).padStart(2, "0")}`,
  src: `https://lh3.googleusercontent.com/d/${id}=w1400`,
  alt: `Momento do Culto de Domingo na Casa em 18 de outubro — foto ${String(index + 1).padStart(2, "0")}`,
  className: orientation === "vertical" ? "home-gallery-tall" : "home-gallery-wide",
}));

export function getGalleryPhoto(slug: string) { return GALLERY_PHOTOS.find(photo => photo.slug === slug); }
export function getPhotoHref(slug: string) { return `/fotos/${slug}`; }
