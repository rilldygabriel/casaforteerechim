import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Igreja Casa Forte Erechim",
    short_name: "Casa Forte",
    description:
      "Você tem um lugar aqui. Conheça a Igreja Casa Forte em Erechim.",
    start_url: "/",
    display: "standalone",
    background_color: "#080908",
    theme_color: "#080908",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
