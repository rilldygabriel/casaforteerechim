import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let body: { fullName?: unknown; phone?: unknown; gender?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const fullName =
    typeof body.fullName === "string"
      ? body.fullName.trim().replace(/\s+/g, " ")
      : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const phoneDigits = phone.replace(/\D/g, "");
  const gender = typeof body.gender === "string" ? body.gender.trim().toLowerCase() : "";

  if (
    fullName.length < 3 ||
    fullName.length > 160 ||
    phoneDigits.length < 10 ||
    phoneDigits.length > 15 ||
    !["masculino", "feminino"].includes(gender)
  ) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const service = getSupabaseServiceClient();
  const { error } = await service
    .from("member_profiles")
    .update({ full_name: fullName, phone, gender })
    .eq("user_id", user.id);

  if (error) {
    console.error("Falha ao completar cadastro Google.", {
      code: error.code,
    });
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  return NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
