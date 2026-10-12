export type GalleryPhoto = {
  slug: string;
  src: string;
  alt: string;
  className: string;
};

const CULT_DATE = "11 de outubro";

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
  ["1zqcv3bdCGlVD1jL68XVCyZGgXqz_UDob", "horizontal"],
  ["1Q5EltfSXKEQt8fcjv1tDFo7z3yLUpXbF", "vertical"],
  ["1XFtP5zqOwaUWS0HzyUvroYihezuB7pWI", "horizontal"],
  ["1h3d4MFet7wbXzIAGnoAdO5rgtZf-DlWU", "vertical"],
  ["1n00Rr6IuOBxX0SxWZ79TWxvaEnNZzfrj", "horizontal"],
  ["1VVvQyOBxfGSgebcWq9rqbihkdqRW-HIc", "vertical"],
  ["15tVCnN1Hcwix2g5qxs6OqJrLZM9LbFxr", "horizontal"],
  ["1jfcZyJhdZ2D0IEn-BSijF3PSca9TnrnO", "vertical"],
  ["1oss21hducM4qmnNslEqYRYDlmYEoSw3U", "horizontal"],
  ["1yzdzBJGfNnYevPqLVDSX__N8ZWWU-DXf", "vertical"],
  ["1L8NjKnVQ6IUz-9gBGlv_kz5n34CGCYmF", "horizontal"],
  ["1lBwzZ9zzLvj3zStCGh08xj_hq8pNUYU0", "vertical"],
  ["1-8YtmM9fbvaH20WyI5B0avoD-TFuZU8s", "horizontal"],
  ["1XN6uFCjz1BAOhe1B7PTdcOnW3dPasq5g", "vertical"],
  ["17gej_fF1qG2nlMwEzgxHl4JBlNSeS2jU", "horizontal"],
  ["1jT_G9ujqEPOYelkiwfokM8JCoCYg0DgZ", "vertical"],
  ["1Q1ntHnaX2dfirdJ8gK0F3ZNqwEtc5T98", "horizontal"],
  ["1RMBU-hvCJ4xtxC3kzV3RJqQaTZ2RwIJA", "vertical"],
  ["1r5lXFI8MAeLdpZEXFlKu8KuhpURuu_Sw", "horizontal"],
  ["1nUkR-i2dVe3rb9tjlikaeYroOb6N7mxY", "vertical"],
];

export const GALLERY_PHOTOS: GalleryPhoto[] = FEATURED_PHOTOS.map(
  ([id, orientation], index) => ({
    slug: `culto-de-domingo-11-10-foto-${String(index + 1).padStart(2, "0")}`,
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
