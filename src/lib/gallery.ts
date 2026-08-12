export type GalleryPhoto = {
  slug: string;
  src: string;
  alt: string;
  className: string;
};

export const GALLERY_PHOTOS: GalleryPhoto[] = [
  {
    slug: "culto-de-domingo-09-08-foto-01",
    src: "/images/momentos/2026-08-09/galeria-01.jpg",
    alt: "Família reunida no culto de domingo da Igreja Casa Forte em 9 de agosto",
    className: "",
  },
  {
    slug: "culto-de-domingo-09-08-foto-02",
    src: "/images/momentos/2026-08-09/galeria-02.jpg",
    alt: "Comunhão na chegada ao culto de domingo da Casa Forte",
    className: "",
  },
  {
    slug: "culto-de-domingo-09-08-foto-03",
    src: "/images/momentos/2026-08-09/galeria-03.jpg",
    alt: "Igreja reunida em família antes da celebração",
    className: "",
  },
  {
    slug: "culto-de-domingo-09-08-foto-04",
    src: "/images/momentos/2026-08-09/galeria-04.jpg",
    alt: "Alegria e comunhão entre os membros da Casa Forte",
    className: "",
  },
  {
    slug: "culto-de-domingo-09-08-foto-05",
    src: "/images/momentos/2026-08-09/galeria-05.jpg",
    alt: "Momento especial durante o culto de domingo",
    className: "",
  },
  {
    slug: "culto-de-domingo-09-08-foto-06",
    src: "/images/momentos/2026-08-09/galeria-06.jpg",
    alt: "Amizade e acolhimento na Igreja Casa Forte",
    className: "",
  },
  {
    slug: "culto-de-domingo-09-08-foto-07",
    src: "/images/momentos/2026-08-09/galeria-07.jpg",
    alt: "Família participando do culto de domingo",
    className: "",
  },
  {
    slug: "culto-de-domingo-09-08-foto-08",
    src: "/images/momentos/2026-08-09/galeria-08.jpg",
    alt: "Cuidado e comunhão entre gerações na Casa",
    className: "",
  },
  {
    slug: "culto-de-domingo-09-08-foto-09",
    src: "/images/momentos/2026-08-09/galeria-09.jpg",
    alt: "Adoração da igreja durante o culto de domingo",
    className: "",
  },
  {
    slug: "culto-de-domingo-09-08-foto-10",
    src: "/images/momentos/2026-08-09/galeria-10.jpg",
    alt: "Louvor no culto de domingo da Casa Forte",
    className: "",
  },
  {
    slug: "culto-de-domingo-09-08-foto-11",
    src: "/images/momentos/2026-08-09/galeria-11.jpg",
    alt: "Visão geral da igreja reunida em adoração",
    className: "",
  },
  {
    slug: "culto-de-domingo-09-08-foto-12",
    src: "/images/momentos/2026-08-09/galeria-12.jpg",
    alt: "Ministração musical durante o culto da Casa",
    className: "",
  },
  {
    slug: "culto-de-domingo-09-08-foto-13",
    src: "/images/momentos/2026-08-09/galeria-13.jpg",
    alt: "Palavra e louvor na Igreja Casa Forte",
    className: "",
  },
  {
    slug: "culto-de-domingo-09-08-foto-14",
    src: "/images/momentos/2026-08-09/galeria-14.jpg",
    alt: "Celebração da família Casa Forte",
    className: "",
  },
  {
    slug: "culto-de-domingo-09-08-foto-15",
    src: "/images/momentos/2026-08-09/galeria-15.jpg",
    alt: "Igreja adorando em unidade",
    className: "",
  },
  {
    slug: "culto-de-domingo-09-08-foto-16",
    src: "/images/momentos/2026-08-09/galeria-16.jpg",
    alt: "Momento de fé durante o culto de domingo",
    className: "",
  },
  {
    slug: "culto-de-domingo-09-08-foto-17",
    src: "/images/momentos/2026-08-09/galeria-17.jpg",
    alt: "Comunidade reunida na presença de Deus",
    className: "",
  },
  {
    slug: "culto-de-domingo-09-08-foto-18",
    src: "/images/momentos/2026-08-09/galeria-18.jpg",
    alt: "Celebração e comunhão no domingo na Casa",
    className: "",
  },
  {
    slug: "culto-de-domingo-09-08-foto-19",
    src: "/images/momentos/2026-08-09/galeria-19.jpg",
    alt: "Ceia e comunhão na Igreja Casa Forte",
    className: "",
  },
  {
    slug: "culto-de-domingo-09-08-foto-20",
    src: "/images/momentos/2026-08-09/galeria-20.jpg",
    alt: "Família Casa Forte reunida no culto de domingo",
    className: "",
  },
];

export function getGalleryPhoto(slug: string) {
  return GALLERY_PHOTOS.find((photo) => photo.slug === slug);
}

export function getPhotoHref(slug: string) {
  return `/fotos/${slug}`;
}
