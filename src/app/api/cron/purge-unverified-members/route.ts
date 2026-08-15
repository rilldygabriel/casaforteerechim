import { createClient, type User } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseConfig } from "@/lib/supabase/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const VERIFICATION_LIMIT_MS = 30 * 24 * 60 * 60 * 1000;

function isExpiredAndUnverified(user: User, cutoff: number) {
  const createdAt = Date.parse(user.created_at);
  return (
    !user.email_confirmed_at &&
    !user.deleted_at &&
    Number.isFinite(createdAt) &&
    createdAt <= cutoff
  );
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (
    !cronSecret ||
    request.headers.get("authorization") !== `Bearer ${cronSecret}`
  ) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return NextResponse.json(
      { error: "Configuração indisponível." },
      { status: 503 },
    );
  }

  const { url } = getSupabaseConfig();
  const supabase = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const cutoff = Date.now() - VERIFICATION_LIMIT_MS;
  const { data, error } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (error) {
    console.error("unverified_member_list_failed", error.code);
    return NextResponse.json(
      { error: "Não foi possível verificar os cadastros." },
      { status: 503 },
    );
  }

  const expiredUserIds = data.users
    .filter((user) => isExpiredAndUnverified(user, cutoff))
    .map((user) => user.id);

  if (expiredUserIds.length === 0) {
    return NextResponse.json({ checked: data.users.length, deleted: 0 });
  }

  const { data: applications, error: applicationsError } = await supabase
    .from("member_applications")
    .select("id,auth_user_id")
    .in("auth_user_id", expiredUserIds);

  if (applicationsError) {
    console.error(
      "unverified_member_applications_failed",
      applicationsError.code,
    );
    return NextResponse.json(
      { error: "Não foi possível conferir os cadastros vinculados." },
      { status: 503 },
    );
  }

  let deleted = 0;
  for (const application of applications ?? []) {
    if (!application.auth_user_id) continue;

    const { error: deleteUserError } =
      await supabase.auth.admin.deleteUser(application.auth_user_id);
    if (deleteUserError) {
      console.error("unverified_member_delete_failed", deleteUserError.code);
      continue;
    }

    const { error: deleteApplicationError } = await supabase
      .from("member_applications")
      .delete()
      .eq("id", application.id);

    if (deleteApplicationError) {
      console.error(
        "unverified_member_application_cleanup_failed",
        deleteApplicationError.code,
      );
      continue;
    }

    deleted += 1;
  }

  return NextResponse.json({
    checked: data.users.length,
    expired: applications?.length ?? 0,
    deleted,
  });
}
