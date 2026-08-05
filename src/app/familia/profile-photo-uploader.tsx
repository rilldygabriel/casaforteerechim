"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const MAX_SOURCE_SIZE = 12 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 40_000_000;
const MAX_PREPARED_SIZE = 900 * 1024;
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

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: "image/jpeg",
  quality: number,
) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
          return;
        }

        reject(new Error("Não foi possível preparar a foto."));
      },
      type,
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

  let blob = await canvasToBlob(canvas, "image/jpeg", 0.9);

  if (blob.size > MAX_PREPARED_SIZE) {
    blob = await canvasToBlob(canvas, "image/jpeg", 0.75);
  }

  if (blob.size > MAX_PREPARED_SIZE) {
    throw new Error("Não foi possível reduzir a foto para o tamanho permitido.");
  }

  return {
    blob,
    previewUrl: canvas.toDataURL("image/jpeg", 0.9),
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
      message: "Verificando sua sessão…",
    });

    try {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user || user.id !== userId) {
        await supabase.auth.signOut({ scope: "local" });
        setStatus({
          kind: "error",
          message: "Sua sessão expirou. Entre novamente para enviar a foto.",
        });
        router.replace("/familia/login?erro=sessao-expirada");
        router.refresh();
        return;
      }

      setStatus({
        kind: "loading",
        message: "Preparando e enviando sua foto…",
      });

      const { blob, previewUrl } = await preparePhoto(file);
      const response = await fetch("/api/familia/foto-perfil", {
        method: "POST",
        headers: {
          "Content-Type": "image/jpeg",
        },
        body: await blob.arrayBuffer(),
      });
      const result = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (response.status === 401) {
        await supabase.auth.signOut({ scope: "local" });
        setStatus({
          kind: "error",
          message: "Sua sessão expirou. Entre novamente para enviar a foto.",
        });
        router.replace("/familia/login?erro=sessao-expirada");
        router.refresh();
        return;
      }

      if (!response.ok) {
        throw new Error(
          result?.error || "Não foi possível enviar a foto. Tente novamente.",
        );
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

  function openProfile() {
    const profileDetails = document.getElementById("meu-perfil") as HTMLDetailsElement | null;
    if (!profileDetails) return;
    profileDetails.open = true;
    profileDetails.scrollIntoView({ behavior: "smooth", block: "start" });
  }

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
      <button className="family-view-profile" type="button" onClick={openProfile}>
        Ver meu perfil
      </button>
      {status.message ? (
        <p
          className="family-photo-status"
          data-kind={status.kind}
          role="status"
          aria-live="polite"
        >
          {status.message}
        </p>
      ) : null}
    </div>
  );
}
