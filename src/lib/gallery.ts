export type GalleryPhoto = {
  slug: string;
  src: string;
  alt: string;
  className: string;
};

export const GALLERY_PHOTOS: GalleryPhoto[] = [
  {
    slug: "acolhimento-26-07",
    src: "/images/momentos/2026-07-26/7H0A0740.webp",
    alt: "Família sendo acolhida na chegada ao culto da Casa Forte",
    className: "",
  },
  {
    slug: "recepcao-26-07",
    src: "/images/momentos/2026-07-26/7H0A0741.webp",
    alt: "Pessoa chegando com alegria ao culto da Casa Forte",
    className: "",
  },
  {
    slug: "comunhao-26-07",
    src: "/images/momentos/2026-07-26/7H0A0781.webp",
    alt: "Comunhão entre famílias antes do culto da Casa Forte",
    className: "",
  },
  {
    slug: "adoracao-em-familia-26-07",
    src: "/images/momentos/2026-07-26/7H0A0967.webp",
    alt: "Famílias adorando juntas durante o culto",
    className: "",
  },
  {
    slug: "entrega-na-adoracao-26-07",
    src: "/images/momentos/2026-07-26/7H0A1063.webp",
    alt: "Momento de entrega e adoração a Deus",
    className: "home-gallery-tall",
  },
  {
    slug: "emocao-no-culto-26-07",
    src: "/images/momentos/2026-07-26/7H0A1273.webp",
    alt: "Momento de emoção na presença de Deus durante o culto",
    className: "",
  },
  {
    slug: "ministracao-26-07",
    src: "/images/momentos/2026-07-26/7H0A1306.webp",
    alt: "Ministração da Palavra durante o culto da Casa Forte",
    className: "home-gallery-tall",
  },
  {
    slug: "adoracao-26-07",
    src: "/images/momentos/2026-07-26/7H0A1460.webp",
    alt: "Mulher adorando a Deus durante o culto",
    className: "",
  },
  {
    slug: "celebracao-em-familia-26-07",
    src: "/images/momentos/2026-07-26/7H0A1471.webp",
    alt: "Famílias celebrando juntas durante o culto",
    className: "",
  },
  {
    slug: "louvor-26-07",
    src: "/images/momentos/2026-07-26/7H0A1499.webp",
    alt: "Músico servindo no louvor da Casa Forte",
    className: "",
  },
  {
    slug: "louvor-e-entrega-26-07",
    src: "/images/momentos/2026-07-26/7H0A1505.webp",
    alt: "Ministração de louvor e entrega durante o culto",
    className: "",
  },
  {
    slug: "abraco-26-07",
    src: "/images/momentos/2026-07-26/7H0A1854.webp",
    alt: "Abraço cheio de emoção durante o culto da Casa Forte",
    className: "home-gallery-tall",
  },
  {
    slug: "palavra-26-07",
    src: "/images/momentos/2026-07-26/7H0A1882.webp",
    alt: "Pregação da Palavra na Igreja Casa Forte",
    className: "home-gallery-tall",
  },
  {
    slug: "oracao-26-07",
    src: "/images/momentos/2026-07-26/7H0A1908.webp",
    alt: "Homem em oração durante o culto da Casa Forte",
    className: "",
  },
  {
    slug: "presenca-de-deus-26-07",
    src: "/images/momentos/2026-07-26/7H0A2141.webp",
    alt: "Mulher adorando na presença de Deus",
    className: "home-gallery-tall",
  },
];

export function getGalleryPhoto(slug: string) {
  return GALLERY_PHOTOS.find((photo) => photo.slug === slug);
}

export function getPhotoHref(slug: string) {
  return `/fotos/${slug}`;
}
