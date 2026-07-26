import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  GALLERY_PHOTOS,
  getGalleryPhoto,
} from "@/lib/gallery";

type PhotoPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export const dynamicParams = false;

export function generateStaticParams() {
  return GALLERY_PHOTOS.map((photo) => ({
    slug: photo.slug,
  }));
}

export async function generateMetadata({
  params,
}: PhotoPageProps): Promise<Metadata> {
  const { slug } = await params;
  const photo = getGalleryPhoto(slug);

  return {
    title: photo ? `Foto — ${photo.alt}` : "Foto",
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function PhotoPage({ params }: PhotoPageProps) {
  const { slug } = await params;
  const photo = getGalleryPhoto(slug);

  if (!photo) {
    notFound();
  }

  return (
    <main className="photo-viewer-page">
      <header className="photo-viewer-header">
        <Link href="/#o-que-esta-rolando">
          <span aria-hidden="true">←</span>
          Voltar ao site
        </Link>
        <Image
          src="/images/logo-casa-forte.png"
          alt="Igreja Casa Forte"
          width={160}
          height={62}
          priority
        />
      </header>

      <figure className="photo-viewer-figure">
        <div className="photo-viewer-image">
          <Image
            src={photo.src}
            alt={photo.alt}
            fill
            priority
            sizes="100vw"
          />
        </div>
        <figcaption>{photo.alt}</figcaption>
      </figure>

      <Link className="photo-viewer-back" href="/#o-que-esta-rolando">
        Voltar para as fotos do site
      </Link>
    </main>
  );
}
