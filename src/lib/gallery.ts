export type GalleryPhoto = {
  slug: string;
  src: string;
  alt: string;
  className: string;
};

const CULT_DATE = "27 de setembro";

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
  ["18sZSQx3M5CxGXM5uxM9iadTliNbgGwbI", "horizontal"],
  ["1sBt-vN83ucOry3Vaawlaa9udmpVWJgqB", "vertical"],
  ["1twsedgMtrFIWpv4yrsh5y0P8YFIYMUAO", "horizontal"],
  ["10mHhfUsrdx8R9FaiLLxs96gFSAIC_mn6", "vertical"],
  ["1yNzJamMJGkaEw4PtgdYSX9NOtnjtwruo", "horizontal"],
  ["1SSk5YTkuDplGy0zaaf9YRdKgEkKoEdwX", "vertical"],
  ["17Meod4sdJ7z9LQxbUiEiDQUECydNtp9V", "horizontal"],
  ["1o7eW9111giLu7xT02HYLiMiVdAeEft8F", "vertical"],
  ["1AMDYdbn_mf24QOXARY2P2t6KgwdZphNP", "horizontal"],
  ["1mO53HjDwbq_qRT78UD5YqJcz8T5GMzyX", "vertical"],
  ["1i7JMb1D1fH2qAQ4Z6-CW-gNr7lf7DSLQ", "horizontal"],
  ["1rzeh_boj8pv9IpZjH7aahML27iBPzSI_", "vertical"],
  ["1rp7VW-F7L93A0gBCNF0JDQ9mIAaZvYyF", "horizontal"],
  ["1aEpd4XkGsyj77p1f2DX-F0grwjZ00iFH", "vertical"],
  ["1C_3J-ogJnamAhHe_RiwaX7hSbdnzAeQa", "horizontal"],
  ["1Eop4esMDgSf6rsx1tjU4OaCTZlCHxYzj", "vertical"],
  ["1Q2_wrj1OGhoGoWU6txTaSx4ZGwgUkHHO", "horizontal"],
  ["1BxQWrK18oQ5m15jMCspg1WXxguRCMifd", "vertical"],
  ["1byafx72MPNq54iNpcAx_rb8Y_nmkhorp", "horizontal"],
  ["1tX_7hxL5MCx9LrEubKHXfFw0VwlGrBHX", "vertical"],
];

export const GALLERY_PHOTOS: GalleryPhoto[] = FEATURED_PHOTOS.map(
  ([id, orientation], index) => ({
    slug: `culto-de-domingo-27-09-foto-${String(index + 1).padStart(2, "0")}`,
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
