"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function PhotoNavigation({ previousSlug, nextSlug }: { previousSlug: string; nextSlug: string }) {
  const router = useRouter();

  useEffect(() => {
    function navigate(event: KeyboardEvent) {
      if (event.key === "ArrowLeft") router.push(`/fotos/${previousSlug}`);
      if (event.key === "ArrowRight") router.push(`/fotos/${nextSlug}`);
    }
    window.addEventListener("keydown", navigate);
    return () => window.removeEventListener("keydown", navigate);
  }, [nextSlug, previousSlug, router]);

  return <nav className="photo-viewer-navigation" aria-label="Navegação entre fotos">
    <Link href={`/fotos/${previousSlug}`} aria-label="Ver foto anterior"><span aria-hidden="true">←</span><strong>Anterior</strong></Link>
    <Link href={`/fotos/${nextSlug}`} aria-label="Ver próxima foto"><strong>Próxima</strong><span aria-hidden="true">→</span></Link>
  </nav>;
}
