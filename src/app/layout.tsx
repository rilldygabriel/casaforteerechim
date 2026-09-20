import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { GeistSans } from "geist/font/sans";
import ScrollToTop from "@/components/scroll-to-top";
import SiteBackButton from "@/components/site-back-button";
import SiteRefreshButton from "@/components/site-refresh-button";
import ThemeToggle from "@/components/theme-toggle";
import SiteAssistant from "@/components/site-assistant";
import SiteNotificationBell from "@/components/site-notification-bell";
import "./globals.css";
import "./casa-ai-overrides.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.casaforteerechim.app.br"),
  title: {
    default: "Igreja Casa Forte Erechim",
    template: "%s | Igreja Casa Forte Erechim",
  },
  description:
    "Você tem um lugar aqui. Conheça a Igreja Casa Forte em Erechim e venha viver Jesus em família.",
  applicationName: "Igreja Casa Forte Erechim",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Casa Forte",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      {
        url: "/icon.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
    apple: [
      {
        url: "/apple-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
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
  viewportFit: "cover",
  themeColor: "#080908",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={GeistSans.variable} data-theme="dark" suppressHydrationWarning>
      <head>
        <Script id="casa-forte-theme" src="/theme-init.js" strategy="beforeInteractive" />
        <Script
          id="casa-forte-scroll-restoration"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html:
              'if("scrollRestoration" in history){history.scrollRestoration="manual";}',
          }}
        />
      </head>
      <body>
        <ScrollToTop />
        <SiteNotificationBell floating />
        <SiteBackButton floating />
        <SiteRefreshButton floating />
        <ThemeToggle floating />
        <SiteAssistant />
        {children}
      </body>
    </html>
  );
}
