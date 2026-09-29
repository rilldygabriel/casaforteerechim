import type { Metadata } from "next";
import Link from "next/link";
import LiveWorship from "@/components/live-worship";
import SiteBackButton from "@/components/site-back-button";
import SiteRefreshButton from "@/components/site-refresh-button";
import SiteNotificationBell from "@/components/site-notification-bell";
import ThemeToggle from "@/components/theme-toggle";

export const metadata: Metadata = {
  title: "Cultos ao vivo",
  description: "Assista aos cultos da Igreja Casa Forte Erechim. Quartas às 19h30 e domingos às 19h, horário de Brasília.",
};

export default function LivePage() {
  return <main className="inner-page" style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 20px 40px" }}>
    <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 20, marginBottom: 32 }}>
      <Link href="/">Casa Forte</Link>
      <div className="home-header-tools">
        <SiteNotificationBell /><SiteBackButton /><SiteRefreshButton /><ThemeToggle />
      </div>
    </header>
    <h1 style={{ fontSize: "clamp(36px, 6vw, 64px)", lineHeight: 1.1, marginBottom: 24 }}>Cultos ao vivo</h1>
    <LiveWorship expanded />
    <Link href="/">Página inicial da Casa</Link>
  </main>;
}
