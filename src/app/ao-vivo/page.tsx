import type { Metadata } from "next";
import Link from "next/link";
import LiveWorship from "@/components/live-worship";

export const metadata: Metadata = {
  title: "Cultos ao vivo | Casa Forte",
  description: "Assista aos cultos da Igreja Casa Forte Erechim. Quartas às 19h30 e domingos às 19h, horário de Brasília.",
};

export default function LivePage() {
  return <main className="inner-page" style={{ maxWidth: 1100, margin: "0 auto", padding: "100px 20px 40px" }}>
    <h1>Cultos ao vivo</h1>
    <LiveWorship expanded />
    <Link href="/">Página inicial da Casa</Link>
  </main>;
}
