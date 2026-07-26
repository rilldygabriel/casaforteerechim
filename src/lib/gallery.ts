export type GalleryPhoto = {
  slug: string;
  src: string;
  alt: string;
  className: string;
};

export const GALLERY_PHOTOS: GalleryPhoto[] = [
  {
    slug: "culto-casa-cheia",
    src: "/images/momentos/culto-casa-cheia.jpeg",
    alt: "Igreja Casa Forte reunida durante o culto",
    className: "home-gallery-wide",
  },
  {
    slug: "adoracao-jovem",
    src: "/images/momentos/adoracao-jovem.jpeg",
    alt: "Jovem adorando a Deus durante o culto",
    className: "",
  },
  {
    slug: "abraco",
    src: "/images/abraco.jpg",
    alt: "Momento de comunhão e abraço na Casa Forte",
    className: "",
  },
  {
    slug: "oracao-no-palco",
    src: "/images/momentos/oracao-no-palco.jpeg",
    alt: "Pastor em oração durante a ministração",
    className: "",
  },
  {
    slug: "recepcao-alegria",
    src: "/images/momentos/recepcao-alegria.jpeg",
    alt: "Família sendo recebida com alegria na Casa Forte",
    className: "",
  },
  {
    slug: "familia",
    src: "/images/familia.jpg",
    alt: "Família celebrando na Igreja Casa Forte",
    className: "home-gallery-wide",
  },
  {
    slug: "adoracao-em-familia",
    src: "/images/momentos/adoracao-em-familia.jpeg",
    alt: "Momento de adoração em família",
    className: "",
  },
  {
    slug: "culto-cruz-iluminada",
    src: "/images/momentos/culto-cruz-iluminada.jpeg",
    alt: "Culto na Casa Forte com a cruz iluminada",
    className: "home-gallery-wide",
  },
  {
    slug: "pastora-lisy-recepcao",
    src: "/images/momentos/pastora-lisy-recepcao.jpeg",
    alt: "Pastora Lisy acolhendo pessoas na recepção",
    className: "",
  },
  {
    slug: "adoracao-jovem-2",
    src: "/images/adoracao-jovem.jpg",
    alt: "Jovem adorando durante um culto",
    className: "",
  },
  {
    slug: "abraco-na-recepcao",
    src: "/images/momentos/abraco-na-recepcao.jpeg",
    alt: "Abraço de boas-vindas na recepção da Casa Forte",
    className: "",
  },
  {
    slug: "ministracao",
    src: "/images/7H0A8738.jpeg",
    alt: "Ministração na Igreja Casa Forte",
    className: "",
  },
  {
    slug: "pastores-no-palco",
    src: "/images/momentos/pastores-no-palco.jpeg",
    alt: "Pastores Rilldy e Lisy ministrando juntos",
    className: "home-gallery-wide",
  },
  {
    slug: "recepcao",
    src: "/images/recepcao.jpg",
    alt: "Recepção da Igreja Casa Forte",
    className: "",
  },
  {
    slug: "celebracao",
    src: "/images/celebracao.jpg",
    alt: "Celebração alegre na Igreja Casa Forte",
    className: "home-gallery-wide",
  },
];

export function getGalleryPhoto(slug: string) {
  return GALLERY_PHOTOS.find((photo) => photo.slug === slug);
}

export function getPhotoHref(slug: string) {
  return `/fotos/${slug}`;
}
