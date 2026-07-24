import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.casaforteerechim.app.br"),
  title: {
    default: "Igreja Casa Forte Erechim",
    template: "%s | Igreja Casa Forte Erechim",
  },
  description:
    "Você tem um lugar aqui. Conheça a Igreja Casa Forte em Erechim e venha viver Jesus em família.",
  applicationName: "Igreja Casa Forte Erechim",
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: "/",
    siteName: "Igreja Casa Forte Erechim",
    title: "Você tem um lugar aqui | Igreja Casa Forte Erechim",
    description:
      "Não ande sozinho. Vem pra casa. Domingo às 19h, em Erechim.",
    images: [
      {
        url: "/images/hero.jpg",
        width: 1536,
        height: 1024,
        alt: "Culto na Igreja Casa Forte Erechim",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Você tem um lugar aqui | Igreja Casa Forte Erechim",
    description:
      "Não ande sozinho. Vem pra casa. Domingo às 19h, em Erechim.",
    images: ["/images/hero.jpg"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#080908",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={GeistSans.variable}>
      <body>{children}</body>
    </html>
  );
}
