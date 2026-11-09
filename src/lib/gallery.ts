export type GalleryPhoto = { slug: string; src: string; alt: string; className: string };

const FEATURED_PHOTOS = [
  [
    "1oEC9XKPhDviGP8OJFiU8R1s_bLvdUoAT",
    "horizontal"
  ],
  [
    "1fklao0p0oMkRSIlaJI10VW_fiBeSnbUt",
    "horizontal"
  ],
  [
    "17VZk50w7dZ9VbXbG5xSKOHOCvf_vNgOi",
    "vertical"
  ],
  [
    "1wxN1vdq1p6pwnfbGDC2NLkLxy39XVCSL",
    "horizontal"
  ],
  [
    "1GnxfsHXitb-BYrguEXjp8O2cKmSN2M4h",
    "vertical"
  ],
  [
    "1d2TgM9XMt9XQeYU0Yk4Tq5Hjfv7EO49P",
    "vertical"
  ],
  [
    "14IeDK8AM0Dp1h2rM91vNCnokkuLAqX2W",
    "horizontal"
  ],
  [
    "14crNLdSsV_AvjcRDu47Vpt1i4wPY1pYR",
    "horizontal"
  ],
  [
    "1KQL4T2UQP_Lw6pDFmPrnLAyDffZIsXjd",
    "vertical"
  ],
  [
    "1Zp_sDTNmwwctvoSEsxfM7N36LWgXhjEc",
    "horizontal"
  ],
  [
    "1ogSgzQ51NH_VuQSjIvFhcHpnXSj8avDa",
    "vertical"
  ],
  [
    "1StkjzrMLUoZL17uBgyu6owyKW_AA6Zl8",
    "horizontal"
  ],
  [
    "1yMTLWoHtdzsVJWlniF_JIr3CBreIyt--",
    "horizontal"
  ],
  [
    "1mvkdqIZ53R9HOkKREwwYvrNyOTyPwiAc",
    "horizontal"
  ],
  [
    "1JQbvbeR0Sc2CcCIBnraFQKZL57XIob3O",
    "vertical"
  ],
  [
    "1MpNs2fwOqB_Rtx1fPIrUOpqQxk_gUbpj",
    "horizontal"
  ],
  [
    "1QRYxrGcAYp2sIw79qUztp-4eMN89Wzjw",
    "horizontal"
  ],
  [
    "1sDFeibnjh8qetcNfzyBXRVQ-WRmt5pct",
    "vertical"
  ],
  [
    "1fpj55vKJZf-QgdNWqPLGiiyjUdSMP95Q",
    "vertical"
  ],
  [
    "14sKf8sR07bW2MyWcC0HoE8-nve6wmxdh",
    "horizontal"
  ]
] as const;

export const GALLERY_PHOTOS: GalleryPhoto[] = FEATURED_PHOTOS.map(([id, orientation], index) => ({
  slug: `culto-de-domingo-08-11-foto-${String(index + 1).padStart(2, "0")}`,
  src: `https://lh3.googleusercontent.com/d/${id}=w1400`,
  alt: `Momento do Culto de Domingo na Casa em 8 de novembro — foto ${String(index + 1).padStart(2, "0")}`,
  className: orientation === "vertical" ? "home-gallery-tall" : "home-gallery-wide",
}));

export function getGalleryPhoto(slug: string) { return GALLERY_PHOTOS.find(photo => photo.slug === slug); }
export function getPhotoHref(slug: string) { return `/fotos/${slug}`; }
