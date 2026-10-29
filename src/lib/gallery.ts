export type GalleryPhoto = { slug: string; src: string; alt: string; className: string };

const FEATURED_PHOTOS = [
  [
    "1r33t1_1ZfQV_goBfOz8XVOGPyilDpUWy",
    "horizontal"
  ],
  [
    "18ytviZlwSWCT6RdNKjH1bXvwU2eCHs0a",
    "vertical"
  ],
  [
    "13PCTxivpSxw_2HOBiAv4tJy6f6WHT5zL",
    "horizontal"
  ],
  [
    "1ALq1WGP5ejbUhy-zVOCMe2C_ubHsk0tj",
    "vertical"
  ],
  [
    "1-5aOkJBqTNdIV0bExmN9bFauSvMNbVP8",
    "horizontal"
  ],
  [
    "1RgLZyJLKqR7eCiY1UpWyJtfqWK9TXXfQ",
    "vertical"
  ],
  [
    "1clv2bo6zlpRBqKf6VMl8TdPFurCBf45D",
    "horizontal"
  ],
  [
    "15w-7MwiS_UaTuLejpvQi28fNYD373l98",
    "vertical"
  ],
  [
    "1oTwXOYdj8ALSmTtxRcl-MhubcBO7QQS9",
    "horizontal"
  ],
  [
    "17UZzuraMJXEvvTv2Tt2XoyS-_F-DSfRL",
    "vertical"
  ],
  [
    "1Ys4kxAQcpAy01R-7ahbB_6I8-uJN7y7T",
    "horizontal"
  ],
  [
    "1EmiG8ugMzLoGzQrsB4JZuMML9qJBTu_L",
    "vertical"
  ],
  [
    "19b_cR3J7-e1Btvc5I7Ga3-UBUGp7M_Td",
    "horizontal"
  ],
  [
    "12J1EvRijLchFips9EwbXEOJPRqIo0WtR",
    "vertical"
  ],
  [
    "1AX5aEt1LVfynUfiFoMzYa298GGCRD5cG",
    "horizontal"
  ],
  [
    "1i0Rc21gU261V_BxPhgq-NLLBNwLhqzAF",
    "vertical"
  ],
  [
    "1huXcqkJ6iqpZAxwFGjtZ7l7dbQz4KLQS",
    "horizontal"
  ],
  [
    "1vlvDV86kHYSJQBNbnzhHNABRtFwc4d5Q",
    "vertical"
  ],
  [
    "1ZpyyemFVQQ2t_oVb_Mol8NEJC_dy9cNx",
    "horizontal"
  ],
  [
    "1BTW6diSNJs-ZKkg6S3a1bi58mnOyuY6R",
    "vertical"
  ]
] as const;

export const GALLERY_PHOTOS: GalleryPhoto[] = FEATURED_PHOTOS.map(([id, orientation], index) => ({
  slug: `culto-de-domingo-25-10-foto-${String(index + 1).padStart(2, "0")}`,
  src: `https://lh3.googleusercontent.com/d/${id}=w1400`,
  alt: `Momento do Culto de Domingo na Casa em 25 de outubro — foto ${String(index + 1).padStart(2, "0")}`,
  className: orientation === "vertical" ? "home-gallery-tall" : "home-gallery-wide",
}));

export function getGalleryPhoto(slug: string) { return GALLERY_PHOTOS.find(photo => photo.slug === slug); }
export function getPhotoHref(slug: string) { return `/fotos/${slug}`; }
