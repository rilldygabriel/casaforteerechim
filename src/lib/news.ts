import "server-only";

import { getSupabaseServerClient } from "@/lib/supabase/server";

export const NEWS_IMAGE_BUCKET = "casa-news-images";
export const MAX_NEWS_IMAGES = 5;
export const MAX_NEWS_BODY_LENGTH = 2000;

export type NewsImage = {
  id?: string;
  image_url: string;
  storage_path: string | null;
  position: number;
  is_cover: boolean;
};

export type NewsPost = {
  id: string;
  slug: string;
  title: string;
  body: string;
  status: "published" | "draft";
  published_at: string;
  created_at: string;
  updated_at: string;
  news_images: NewsImage[] | null;
};

export async function getNewsManager() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("member_profiles")
    .select("full_name,can_manage_news")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile?.can_manage_news) return null;

  return { user, profile };
}

export function createNewsSlug(title: string) {
  return title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96) || "noticia-da-casa";
}

export function sortNewsImages(images: NewsImage[] | null | undefined) {
  return [...(images ?? [])].sort((a, b) => a.position - b.position);
}

export function coverForNews(post: Pick<NewsPost, "news_images">) {
  const images = sortNewsImages(post.news_images);
  return images.find((image) => image.is_cover) ?? images[0] ?? null;
}
