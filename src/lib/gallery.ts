export type GalleryPhoto = {
  slug: string;
  src: string;
  alt: string;
  className: string;
};

const CULT_DATE = "20 de setembro";

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
  ["1Lzp2nu83s4EC8GqzS-AHHiqdCYBBGxLW", "horizontal"],
  ["1YhangK6LOd4-dy962v6qVxc6Iiegrxbq", "vertical"],
  ["18XKFisneoLV2XxszVVaB_uXRywIoagZk", "horizontal"],
  ["1MvqbBzH532gXx9V5hBcuBGIAs4jarvUj", "vertical"],
  ["13UYtMUOGdUtFkIXVLGxpiJyynqjmKVj7", "horizontal"],
  ["1C6KQENSxxfSDpY43tclmZa_xOvP6Td4o", "vertical"],
  ["1fgoF8xvtWUcgU4Xe6nAb0HdHzzXhNSlr", "horizontal"],
  ["1rvpCp1fuJjgHxe7ntNXmVFj9pVeAq3mv", "vertical"],
  ["1QAXQADyocOqowK-0y9DHC3uEy3g4GUhr", "horizontal"],
  ["1I5XKf01An5TtjbX-kYl0ScZSucxE_tYd", "vertical"],
  ["1dMHxf4zfAQWDuAEZH5wE-zs5dUsdT40G", "horizontal"],
  ["1PlQxCrMn420n5ThsaS9G4Y6v20UpClxD", "vertical"],
  ["19NNjaGvshVRVGfTaYRj2bXxyP0vxAx8L", "horizontal"],
  ["1PE0DiOx-yjIbKg9776_v0BLuxY8BW9nC", "vertical"],
  ["1YFElshtNg3IQRtdfXBJjtq8-pYb2Eoju", "horizontal"],
  ["1kSdMwvVG47IsKJIY3nSWhQkXaDwIpiBU", "vertical"],
  ["1VuMAAtXdm-cBBqlb4k3Jkv1LsWpVBZmU", "horizontal"],
  ["12feI3oVesT27J57-KNjl1GMh99nz__31", "vertical"],
  ["18syGRuBTEOn5vsB-WdIlVtpqybrfv8-Q", "horizontal"],
  ["1lkNas_16-Nb98lDc5Nej4lCs05fsZPbV", "vertical"],
];

export const GALLERY_PHOTOS: GalleryPhoto[] = FEATURED_PHOTOS.map(
  ([id, orientation], index) => ({
    slug: `culto-de-domingo-20-09-foto-${String(index + 1).padStart(2, "0")}`,
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
