export type GalleryPhoto = {
  slug: string;
  src: string;
  alt: string;
  className: string;
};

const CULT_DATE = "6 de setembro";

const SEPTEMBER_SECOND_FEATURED_PHOTOS = [
  ["1mhXleux7KFeCd1y-bZ-IGPAHeD9enJ8f", "horizontal"],
  ["1rVIOgx1hF_BbNSrP78KK7Y7BKN-rQtBV", "vertical"],
  ["12Fja3VW2xjLZnPANcQ8QFSQOqluSUck7", "horizontal"],
  ["1flZKa7CGuQarg-Qxu2C9wzfG9aMZiJLz", "horizontal"],
  ["1nr8YBy4wvdn9K4ETWxHBErgJ1diHn9Nx", "vertical"],
  ["1eD8WuSuYn4MP5XiU9Ox_GAmN5ZRMy9Cy", "horizontal"],
  ["1mX-k96KvuQmPAFpzzcN8a20KSQ2XSf8P", "horizontal"],
  ["1StgPyPrbwTx0dpQr2_exuA43crfHvXT7", "vertical"],
  ["1YQx5QT58-BwqXlGiILKvJ5DiS9mwBWNL", "horizontal"],
  ["1_yi3k6cu_z4dPjPOOwjzscRJivXcjLls", "horizontal"],
  ["1Trbd1m5GWD0381mVXuildz-zDcXd3EMO", "vertical"],
  ["1Ka1m-F2pQUozGW6q4-BRqftbZHPW2CZT", "horizontal"],
  ["1V29wNnPN5ECRcjcymvAp9IHMWbdmRpAB", "horizontal"],
  ["1GrIM24m1aOkqmBwF1OjSNyVIAkF1qzTn", "vertical"],
  ["1220tR71dS7XZOEUET2gNWmgcqZrUYw5C", "horizontal"],
  ["1ZGGIZvRzHcD0y7pN8ksobEk_hMQ1E7VP", "horizontal"],
  ["1ZSx607cL5lt48ghAHC5Dy87pR_ALQlJV", "vertical"],
  ["1zHCQKZfHD3ms4beBrw9s2YmDtdjFhB7z", "horizontal"],
  ["1JGkESH2d5mXZxKaiDwYGmkAm5YRs6oq1", "vertical"],
  ["1RWuXto5M_FwC4FMw_FDjCb-fSTfCgJTD", "horizontal"],
] as const;

const FEATURED_PHOTOS: ReadonlyArray<
  readonly [string, "horizontal" | "vertical"]
> = [
  ["16ZoaED7RLKtJbGEFA0kjmxEpj_VsOWTc", "horizontal"],
  ["1SJzpfGKXGCkBaPxsp3vOMNsd6PIFKH9e", "vertical"],
  ["12vPVXARyjQG0z1w-WqjrK6eeyNrcjgw7", "horizontal"],
  ["1TCnCbH5HInNZNVYyIrYfAegCid3WQ80Z", "vertical"],
  ["1kcDkohUPXPmyXoAxw59plo-WSKuDd0iD", "horizontal"],
  ["1fRLD_Ot8Vnjo8Y-g8Lp319RO1NQ-QN-L", "vertical"],
  ["16vG3NIu4l_IPYOXycDys8lIoMU1kzvpb", "horizontal"],
  ["19ZjqchDaBJJULWz7RcMOAV1plvXQkZ3D", "vertical"],
  ["10XNHvFSCl9hBL0Ymg8nuNWxS7sZ1rhTS", "horizontal"],
  ["1UQSiP8xuHb1VMkhq5BWoSmcnyDOxsfPc", "vertical"],
  ["1VU8ur2rxmvnW4wGqcqvpHB6uUCUSc78Z", "horizontal"],
  ["1Sm_ZawtkoY9GBIXR9wrGwUr_nmplOxF6", "vertical"],
  ["15HMO70-ZHvZLMFclQeHmP7x2kXJG3lWF", "horizontal"],
  ["1otCqZmKEgH-H9RyPrpyIn8gmAevm1FQr", "vertical"],
  ["16-XpayqqFXTaH0vgSFLAb5HGeN0YTGRF", "horizontal"],
  ["1m6nSw5CUtFa17xYN5hC5ouEfWH-uJyXg", "vertical"],
  ["1QWs-JZwHVyq526FudeTuXFG-8EgIHHZC", "horizontal"],
  ["10wG1PxnxS24bdn43PNcI6W8yvsOGUKKl", "vertical"],
  ["1XHTj7G5VftN5JPGhOrkWpoN-w8ExHR87", "horizontal"],
  ["1IgzTqrm_OHqoygpOgdzyfiRWtcC2j1KA", "vertical"],
];

export const GALLERY_PHOTOS: GalleryPhoto[] = FEATURED_PHOTOS.map(
  ([id, orientation], index) => ({
    slug: `culto-de-domingo-06-09-foto-${String(index + 1).padStart(2, "0")}`,
    src: `https://lh3.googleusercontent.com/d/${id}=w1400`,
    alt: `Momento do Culto de Domingo na Casa em ${CULT_DATE} — foto ${String(index + 1).padStart(2, "0")}`,
    className: orientation === "vertical" ? "home-gallery-tall" : "home-gallery-wide",
  }),
);

export function getGalleryPhoto(slug: string) {
  return GALLERY_PHOTOS.find((photo) => photo.slug === slug);
}

export function getPhotoHref(slug: string) {
  return `/fotos/${slug}`;
}
