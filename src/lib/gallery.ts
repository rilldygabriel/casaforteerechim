export type GalleryPhoto = {
  slug: string;
  src: string;
  alt: string;
  className: string;
};

export const GALLERY_PHOTOS: GalleryPhoto[] = [
  {
    slug: "juntos-na-casa-26-07",
    src: "/images/momentos/2026-07-26-completo/galeria-01.webp",
    alt: "Casal celebrando junto no culto da Casa Forte",
    className: "",
  },
  {
    slug: "acolhimento-em-oracao-26-07",
    src: "/images/momentos/2026-07-26-completo/galeria-02.webp",
    alt: "Mulheres acolhendo umas às outras em oração",
    className: "",
  },
  {
    slug: "entrega-a-deus-26-07",
    src: "/images/momentos/2026-07-26-completo/galeria-03.webp",
    alt: "Homem em um momento profundo de entrega a Deus",
    className: "",
  },
  {
    slug: "palavra-com-alegria-26-07",
    src: "/images/momentos/2026-07-26-completo/galeria-04.webp",
    alt: "Ministração da Palavra com alegria na Casa Forte",
    className: "",
  },
  {
    slug: "familia-em-adoracao-26-07",
    src: "/images/momentos/2026-07-26-completo/galeria-05.webp",
    alt: "Família da Casa adorando a Deus em unidade",
    className: "",
  },
  {
    slug: "alegria-na-presenca-26-07",
    src: "/images/momentos/2026-07-26-completo/galeria-06.webp",
    alt: "Mulher sorrindo e adorando na presença de Deus",
    className: "",
  },
  {
    slug: "familia-com-bebe-26-07",
    src: "/images/momentos/2026-07-26-completo/galeria-07.webp",
    alt: "Família reunida com seu bebê na Casa Forte",
    className: "",
  },
  {
    slug: "louvor-e-presenca-26-07",
    src: "/images/momentos/2026-07-26-completo/galeria-08.webp",
    alt: "Louvor conduzindo a igreja à presença de Deus",
    className: "",
  },
  {
    slug: "cuidado-pastoral-26-07",
    src: "/images/momentos/2026-07-26-completo/galeria-09.webp",
    alt: "Homem sendo abraçado e cuidado durante a oração",
    className: "",
  },
  {
    slug: "abraco-de-familia-26-07",
    src: "/images/momentos/2026-07-26-completo/galeria-10.webp",
    alt: "Abraço cheio de alegria e pertencimento na Casa Forte",
    className: "",
  },
  {
    slug: "jovem-em-adoracao-26-07",
    src: "/images/momentos/2026-07-26-completo/galeria-11.webp",
    alt: "Jovem adorando a Deus com as mãos levantadas",
    className: "",
  },
  {
    slug: "gratidao-na-casa-26-07",
    src: "/images/momentos/2026-07-26-completo/galeria-12.webp",
    alt: "Mulher expressando gratidão durante o culto",
    className: "",
  },
  {
    slug: "chegada-em-familia-26-07",
    src: "/images/momentos/2026-07-26-completo/galeria-13.webp",
    alt: "Famílias chegando e sendo recebidas na Casa Forte",
    className: "",
  },
  {
    slug: "igreja-em-unidade-26-07",
    src: "/images/momentos/2026-07-26-completo/galeria-14.webp",
    alt: "Igreja adorando em unidade com as mãos levantadas",
    className: "",
  },
  {
    slug: "emocao-na-presenca-26-07",
    src: "/images/momentos/2026-07-26-completo/galeria-15.webp",
    alt: "Mulher emocionada na presença de Deus",
    className: "",
  },
  {
    slug: "criancas-na-casa-26-07",
    src: "/images/momentos/2026-07-26-completo/galeria-16.webp",
    alt: "Crianças vivendo a alegria de pertencer à Casa",
    className: "",
  },
  {
    slug: "oracao-em-comunidade-26-07",
    src: "/images/momentos/2026-07-26-completo/galeria-17.webp",
    alt: "Pessoas orando juntas e cuidando umas das outras",
    className: "",
  },
  {
    slug: "amizade-na-casa-26-07",
    src: "/images/momentos/2026-07-26-completo/galeria-18.webp",
    alt: "Jovens celebrando a amizade e a comunhão na Casa",
    className: "",
  },
  {
    slug: "intercessao-26-07",
    src: "/images/momentos/2026-07-26-completo/galeria-19.webp",
    alt: "Momento de intercessão e cuidado espiritual",
    className: "",
  },
  {
    slug: "mae-e-filho-na-casa-26-07",
    src: "/images/momentos/2026-07-26-completo/galeria-20.webp",
    alt: "Mãe e filho vivendo juntos a alegria da Casa",
    className: "",
  },
];

export function getGalleryPhoto(slug: string) {
  return GALLERY_PHOTOS.find((photo) => photo.slug === slug);
}

export function getPhotoHref(slug: string) {
  return `/fotos/${slug}`;
}
