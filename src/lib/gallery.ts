export type GalleryPhoto = {
  slug: string;
  src: string;
  alt: string;
  className: string;
};

const CULT_DATE = "4 de outubro";

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
  ["1KnfFTSd4faQe8er8HK9pKnH6zwpUIFtc", "horizontal"],
  ["1kYuwQJYrmsVowphHT2udmKuNHd7DEKhO", "vertical"],
  ["1yY7ZOfY5nZ8Lx0Lrb1_GfIyQrwB57sFW", "horizontal"],
  ["1VAlMo-lsh_2WXPR5n5FNUePO8LlNoaWk", "vertical"],
  ["1t1SRYqqyd352XijpsBNzXHCIwbZT-UY4", "horizontal"],
  ["1xAgoEwVzDRrqfmfxpBppOy7nuseA9T3d", "vertical"],
  ["1bPETx_NVr9HeuVweFiQwjgqItoIqRRDT", "horizontal"],
  ["12EySQuRaymKZ4_2pe_U5e0Xv8Y_-F-P4", "vertical"],
  ["1l2d5iJbNIqyfooXLbkaJFWakG-WEun_z", "horizontal"],
  ["1NQhIe3QL_o7ksW4FiWwmkxgTnCOC9DgT", "vertical"],
  ["1Uvl7mjtwqOW7MItQTk5QWe1pZhrMCE09", "horizontal"],
  ["1ighFCRukd1svMURIPbNq0uF8yEm7nyZg", "vertical"],
  ["1VpiuXUWh4yDRvqOl-av3n4VbNw0BhKcj", "horizontal"],
  ["1nrjpprv4Yapm7GbNLKACg8Pseu6cxdYb", "vertical"],
  ["1Pvz0JEqeFg_iqTVBV0lW_QDODoM8z5e0", "horizontal"],
  ["1Z9Mg0IBH-UnJeCdJsm4YWAlLdfLqAgbo", "vertical"],
  ["1v7L3Elmo8J0I4xdE5P5D_8tW4EnSfFtQ", "horizontal"],
  ["1gg863n6uafzvD4tJIpQHj4Ks8uo29ST1", "vertical"],
  ["17DefD7vs25zpVfZ8vMP_NdAbAtoAFK-B", "horizontal"],
  ["1U8cIdAhthlKJHjafSzsR9d-2MZLACxR1", "vertical"],
];

export const GALLERY_PHOTOS: GalleryPhoto[] = FEATURED_PHOTOS.map(
  ([id, orientation], index) => ({
    slug: `culto-de-domingo-04-10-foto-${String(index + 1).padStart(2, "0")}`,
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
