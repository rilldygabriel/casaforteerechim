"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const PROFILE_PHOTOS_BUCKET = "member-profile-photos";
const MAX_SOURCE_SIZE = 12 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 40_000_000;
const OUTPUT_SIZE = 512;

type PhotoStatus = {
  kind: "idle" | "loading" | "success" | "error";
  message: string;
};

function getInitials(fullName: string) {
  const names = fullName.trim().split(/\s+/).filter(Boolean);

  if (names.length === 0) {
    return "CF";
  }

  const first = names[0]?.[0] ?? "";
  const last = names.length > 1 ? names.at(-1)?.[0] ?? "" : "";

  return `${first}${last}`.toLocaleUpperCase("pt-BR");
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = document.createElement("img");

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Não foi possível abrir esta imagem."));
    };
    image.src = objectUrl;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
          return;
        }

        reject(new Error("Não foi possível preparar a foto."));
      },
      "image/webp",
      quality,
    );
  });
}

async function preparePhoto(file: File) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Escolha um arquivo de imagem.");
  }

  if (file.size > MAX_SOURCE_SIZE) {
    throw new Error("A foto original deve ter no máximo 12 MB.");
  }

  const image = await loadImage(file);
  const pixelCount = image.naturalWidth * image.naturalHeight;

  if (
    image.naturalWidth === 0 ||
    image.naturalHeight === 0 ||
    pixelCount > MAX_IMAGE_PIXELS
  ) {
    throw new Error("Escolha uma foto com resolução menor.");
  }

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Este navegador não conseguiu preparar a foto.");
  }

  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;

  const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
  const sourceX = (image.naturalWidth - sourceSize) / 2;
  const sourceY = (image.naturalHeight - sourceSize) / 2;

  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceSize,
    sourceSize,
    0,
    0,
    OUTPUT_SIZE,
    OUTPUT_SIZE,
  );

  let blob = await canvasToBlob(canvas, 0.84);

  if (blob.size > 1024 * 1024) {
    blob = await canvasToBlob(canvas, 0.7);
  }

  if (blob.size > 1024 * 1024) {
    throw new Error("Não foi possível reduzir a foto para o tamanho permitido.");
  }

  return {
    blob,
    previewUrl: canvas.toDataURL("image/webp", 0.84),
  };
}

export function ProfilePhotoUploader({
  userId,
  fullName,
  initialPhotoUrl,
}: {
  userId: string;
  fullName: string;
  initialPhotoUrl: string | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [photoUrl, setPhotoUrl] = useState(initialPhotoUrl);
  const [status, setStatus] = useState<PhotoStatus>({
    kind: "idle",
    message: "",
  });

  async function handleFile(file: File | undefined) {
    if (!file) {
      return;
    }

    setStatus({
      kind: "loading",
      message: "Preparando e enviando sua foto…",
    });

    try {
      const { blob, previewUrl } = await preparePhoto(file);
      const supabase = getSupabaseBrowserClient();
      const photoPath = `${userId}/${crypto.randomUUID()}.webp`;
      const { error: uploadError } = await supabase.storage
        .from(PROFILE_PHOTOS_BUCKET)
        .upload(photoPath, blob, {
          cacheControl: "3600",
          contentType: "image/webp",
          upsert: false,
        });

      if (uploadError) {
        throw new Error("Não foi possível enviar a foto. Tente novamente.");
      }

      const { data: updatedProfile, error: profileError } = await supabase
        .from("member_profiles")
        .update({ photo_url: photoPath })
        .eq("user_id", userId)
        .select("photo_url")
        .maybeSingle();

      if (profileError || updatedProfile?.photo_url !== photoPath) {
        throw new Error("A foto foi enviada, mas não pôde ser ligada ao perfil.");
      }

      setPhotoUrl(previewUrl);
      setStatus({
        kind: "success",
        message: "Foto atualizada com sucesso.",
      });
      router.refresh();
    } catch (error) {
      setStatus({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível atualizar sua foto.",
      });
    } finally {
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  const loading = status.kind === "loading";

  return (
    <div className="family-photo-editor">
      <div className="family-photo-frame">
        {photoUrl ? (
          <Image
            src={photoUrl}
            alt={`Foto de perfil de ${fullName}`}
            fill
            sizes="(max-width: 780px) 128px, 150px"
            unoptimized
          />
        ) : (
          <span aria-hidden="true">{getInitials(fullName)}</span>
        )}
      </div>

      <input
        ref={inputRef}
        className="family-photo-input"
        type="file"
        accept="image/*"
        aria-label="Escolher foto de perfil"
        onChange={(event) => void handleFile(event.target.files?.[0])}
      />
      <button
        type="button"
        disabled={loading}
        onClick={() => inputRef.current?.click()}
      >
        {loading
          ? "Enviando…"
          : photoUrl
            ? "Trocar foto"
            : "Adicionar foto"}
      </button>
      <p
        className="family-photo-status"
        data-kind={status.kind}
        role="status"
        aria-live="polite"
      >
        {status.message || "JPG, PNG ou WEBP. A foto será ajustada automaticamente."}
      </p>
    </div>
  );
}
