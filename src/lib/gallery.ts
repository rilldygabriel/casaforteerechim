export type GalleryPhoto = {
  slug: string;
  src: string;
  alt: string;
  className: string;
};

export const GALLERY_PHOTOS: GalleryPhoto[] = [
  {
    slug: "culto-de-domingo-02-08-foto-01",
    src: "/images/momentos/2026-08-02/galeria-01.jpg",
    alt: "Momento do culto de domingo na Igreja Casa Forte em 2 de agosto",
    className: "",
  },
  {
    slug: "culto-de-domingo-02-08-foto-02",
    src: "/images/momentos/2026-08-02/galeria-02.jpg",
    alt: "Igreja reunida no culto de domingo da Casa Forte",
    className: "",
  },
  {
    slug: "culto-de-domingo-02-08-foto-03",
    src: "/images/momentos/2026-08-02/galeria-03.jpg",
    alt: "Comunhão durante o culto de domingo na Casa Forte",
    className: "",
  },
  {
    slug: "culto-de-domingo-02-08-foto-04",
    src: "/images/momentos/2026-08-02/galeria-04.jpg",
    alt: "Celebração no culto de domingo da Igreja Casa Forte",
    className: "",
  },
  {
    slug: "culto-de-domingo-02-08-foto-05",
    src: "/images/momentos/2026-08-02/galeria-05.jpg",
    alt: "Família Casa Forte reunida em adoração",
    className: "",
  },
  {
    slug: "culto-de-domingo-02-08-foto-06",
    src: "/images/momentos/2026-08-02/galeria-06.jpg",
    alt: "Momento de adoração no culto de domingo da Casa Forte",
    className: "",
  },
  {
    slug: "culto-de-domingo-02-08-foto-07",
    src: "/images/momentos/2026-08-02/galeria-07.jpg",
    alt: "Pessoas celebrando juntas na Igreja Casa Forte",
    className: "",
  },
  {
    slug: "culto-de-domingo-02-08-foto-08",
    src: "/images/momentos/2026-08-02/galeria-08.jpg",
    alt: "Louvor durante o culto de domingo na Casa Forte",
    className: "",
  },
  {
    slug: "culto-de-domingo-02-08-foto-09",
    src: "/images/momentos/2026-08-02/galeria-09.jpg",
    alt: "Momento de fé e comunhão na Igreja Casa Forte",
    className: "",
  },
  {
    slug: "culto-de-domingo-02-08-foto-10",
    src: "/images/momentos/2026-08-02/galeria-10.jpg",
    alt: "Alegria no culto de domingo da Casa Forte",
    className: "",
  },
  {
    slug: "culto-de-domingo-02-08-foto-11",
    src: "/images/momentos/2026-08-02/galeria-11.jpg",
    alt: "Adoração e entrega no culto de domingo",
    className: "",
  },
  {
    slug: "culto-de-domingo-02-08-foto-12",
    src: "/images/momentos/2026-08-02/galeria-12.jpg",
    alt: "Comunidade reunida na Casa Forte em Erechim",
    className: "",
  },
  {
    slug: "culto-de-domingo-02-08-foto-13",
    src: "/images/momentos/2026-08-02/galeria-13.jpg",
    alt: "Celebração da família Casa Forte no domingo",
    className: "",
  },
  {
    slug: "culto-de-domingo-02-08-foto-14",
    src: "/images/momentos/2026-08-02/galeria-14.jpg",
    alt: "Igreja em unidade durante o culto de domingo",
    className: "",
  },
  {
    slug: "culto-de-domingo-02-08-foto-15",
    src: "/images/momentos/2026-08-02/galeria-15.jpg",
    alt: "Momento especial na presença de Deus na Casa Forte",
    className: "",
  },
  {
    slug: "culto-de-domingo-02-08-foto-16",
    src: "/images/momentos/2026-08-02/galeria-16.jpg",
    alt: "Famílias participando do culto de domingo da Casa Forte",
    className: "",
  },
  {
    slug: "culto-de-domingo-02-08-foto-17",
    src: "/images/momentos/2026-08-02/galeria-17.jpg",
    alt: "Oração em comunidade no culto de domingo",
    className: "",
  },
  {
    slug: "culto-de-domingo-02-08-foto-18",
    src: "/images/momentos/2026-08-02/galeria-18.jpg",
    alt: "Amizade e comunhão na Igreja Casa Forte",
    className: "",
  },
  {
    slug: "culto-de-domingo-02-08-foto-19",
    src: "/images/momentos/2026-08-02/galeria-19.jpg",
    alt: "Intercessão e cuidado durante o culto de domingo",
    className: "",
  },
  {
    slug: "culto-de-domingo-02-08-foto-20",
    src: "/images/momentos/2026-08-02/galeria-20.jpg",
    alt: "Família vivendo a alegria de pertencer à Casa Forte",
    className: "",
  },
];

export function getGalleryPhoto(slug: string) {
  return GALLERY_PHOTOS.find((photo) => photo.slug === slug);
}

export function getPhotoHref(slug: string) {
  return `/fotos/${slug}`;
}
