"use server";

import { getVercelOidcToken } from "@vercel/oidc";
import { revalidatePath } from "next/cache";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const MEMBER_APPROVAL_STATUSES = ["approved", "rejected"] as const;

export type MemberApprovalStatus =
  (typeof MEMBER_APPROVAL_STATUSES)[number];

export type MemberApprovalActionState = {
  kind: "idle" | "success" | "error";
  message: string;
};

export type MemberInviteResendActionState = {
  kind: "idle" | "success" | "error";
  message: string;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SUPABASE_MEMBER_APPROVAL_URL =
  "https://fjwkfpwraipxmcjlwssv.supabase.co/functions/v1/approve-member-application";
const SUPABASE_MEMBER_INVITE_RESEND_URL =
  "https://fjwkfpwraipxmcjlwssv.supabase.co/functions/v1/admin-resend-member-invite";
const VERCEL_TEAM_ID = "team_Pw24QkatuwWyFJiYuYCKi12Z";
const VERCEL_PROJECT_ID = "prj_My9r71EBQYchsF5T97S35WFXV8Kg";

async function getCurrentAdmin() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, user: null };
  }

  const { data: adminProfile } = await supabase
    .from("member_profiles")
    .select("is_admin,approval_status")
    .eq("user_id", user.id)
    .maybeSingle();

  return {
    supabase,
    user:
      adminProfile?.is_admin &&
      adminProfile.approval_status === "approved"
        ? user
        : null,
  };
}

export async function reviewMemberApplication(
  _previousState: MemberApprovalActionState,
  formData: FormData,
): Promise<MemberApprovalActionState> {
  const applicationId = Number(formData.get("applicationId"));
  const decision = String(formData.get("decision") ?? "");

  if (
    !Number.isSafeInteger(applicationId) ||
    applicationId < 1 ||
    !["approve", "reject"].includes(decision)
  ) {
    return {
      kind: "error",
      message: "Os dados desta solicitação são inválidos.",
    };
  }

  const { supabase, user } = await getCurrentAdmin();

  if (!user) {
    return {
      kind: "error",
      message: "Sua sessão expirou ou não possui permissão.",
    };
  }

  const { data: application } = await supabase
    .from("member_applications")
    .select("id,status")
    .eq("id", applicationId)
    .maybeSingle();

  if (!application) {
    return {
      kind: "error",
      message: "Esta solicitação não foi encontrada.",
    };
  }

  if (decision === "reject") {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("member_applications")
      .update({
        status: "rejected",
        reviewed_at: now,
        reviewed_by: user.id,
        updated_at: now,
      })
      .eq("id", applicationId)
      .select("id")
      .maybeSingle();

    if (error || !data) {
      return {
        kind: "error",
        message: "Não foi possível salvar. Nenhum acesso foi alterado.",
      };
    }

    revalidatePath("/admin");
    revalidatePath("/admin/membros");

    return {
      kind: "success",
      message: "Solicitação marcada como não aprovada.",
    };
  }

  if (application.status === "invited") {
    return {
      kind: "success",
      message: "O convite desta pessoa já foi enviado.",
    };
  }

  const resendApiKey = process.env.RESEND_API_KEY;

  if (!resendApiKey) {
    return {
      kind: "error",
      message: "A credencial segura de e-mail não está disponível.",
    };
  }

  const requestId = crypto.randomUUID();

  try {
    const oidcToken = await getVercelOidcToken({
      team: VERCEL_TEAM_ID,
      project: VERCEL_PROJECT_ID,
      expirationBufferMs: 10_000,
    });

    const response = await fetch(SUPABASE_MEMBER_APPROVAL_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${oidcToken}`,
        "Content-Type": "application/json",
        "x-request-id": requestId,
        "x-resend-api-key": resendApiKey,
      },
      body: JSON.stringify({
        applicationId,
        adminUserId: user.id,
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      console.error("Falha protegida ao aprovar membro.", {
        requestId,
        applicationId,
        status: response.status,
      });
      return {
        kind: "error",
        message: "Não foi possível enviar o convite. Tente novamente depois.",
      };
    }
  } catch (error) {
    console.error("Falha ao iniciar convite da Área da Família.", {
      requestId,
      applicationId,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return {
      kind: "error",
      message: "Não foi possível enviar o convite. Tente novamente depois.",
    };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/membros");

  return {
    kind: "success",
    message: "Acesso aprovado e convite enviado com segurança.",
  };
}

export async function updateMemberApproval(
  _previousState: MemberApprovalActionState,
  formData: FormData,
): Promise<MemberApprovalActionState> {
  const memberId = String(formData.get("memberId") ?? "");
  const status = String(formData.get("status") ?? "");

  if (
    !UUID_PATTERN.test(memberId) ||
    !MEMBER_APPROVAL_STATUSES.includes(status as MemberApprovalStatus)
  ) {
    return {
      kind: "error",
      message: "Os dados desta atualização são inválidos.",
    };
  }

  const { supabase, user } = await getCurrentAdmin();

  if (!user) {
    return {
      kind: "error",
      message: "Sua sessão expirou ou não possui permissão.",
    };
  }

  const { data: member } = await supabase
    .from("member_profiles")
    .select("is_admin")
    .eq("user_id", memberId)
    .maybeSingle();

  if (!member || member.is_admin) {
    return {
      kind: "error",
      message: "A conta administrativa não pode ser alterada aqui.",
    };
  }

  const approved = status === "approved";
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("member_profiles")
    .update({
      approval_status: status,
      approved_at: approved ? now : null,
      approved_by: approved ? user.id : null,
      church_status: approved ? "membro" : "aguardando_aprovacao",
      updated_at: now,
    })
    .eq("user_id", memberId)
    .select("user_id")
    .maybeSingle();

  if (error || !data) {
    return {
      kind: "error",
      message: "Não foi possível salvar. Nenhum acesso foi alterado.",
    };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/membros");
  revalidatePath("/familia");

  return {
    kind: "success",
    message: approved
      ? "Acesso à Família liberado com segurança."
      : "Acesso à Família suspenso com segurança.",
  };
}

export async function resendMemberInvite(
  _previousState: MemberInviteResendActionState,
  formData: FormData,
): Promise<MemberInviteResendActionState> {
  const memberId = String(formData.get("memberId") ?? "");

  if (!UUID_PATTERN.test(memberId)) {
    return {
      kind: "error",
      message: "Este cadastro não pôde ser identificado.",
    };
  }

  const { supabase, user } = await getCurrentAdmin();

  if (!user) {
    return {
      kind: "error",
      message: "Sua sessão expirou ou não possui permissão.",
    };
  }

  const { data: member } = await supabase
    .from("member_profiles")
    .select("user_id,email,is_admin,approval_status")
    .eq("user_id", memberId)
    .maybeSingle();

  if (
    !member ||
    member.is_admin ||
    member.approval_status !== "approved" ||
    !member.email
  ) {
    return {
      kind: "error",
      message: "Este cadastro não está disponível para reenvio.",
    };
  }

  const resendApiKey = process.env.RESEND_API_KEY;

  if (!resendApiKey) {
    return {
      kind: "error",
      message: "A credencial segura de e-mail não está disponível.",
    };
  }

  const requestId = crypto.randomUUID();

  try {
    const oidcToken = await getVercelOidcToken({
      team: VERCEL_TEAM_ID,
      project: VERCEL_PROJECT_ID,
      expirationBufferMs: 10_000,
    });
    const response = await fetch(SUPABASE_MEMBER_INVITE_RESEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${oidcToken}`,
        "Content-Type": "application/json",
        "x-request-id": requestId,
        "x-resend-api-key": resendApiKey,
      },
      body: JSON.stringify({
        memberId,
        adminUserId: user.id,
      }),
      cache: "no-store",
    });

    if (response.status === 409) {
      revalidatePath("/admin/membros");
      return {
        kind: "success",
        message: "Esta conta já foi verificada.",
      };
    }

    if (response.status === 429) {
      return {
        kind: "error",
        message: "Aguarde um minuto antes de reenviar novamente.",
      };
    }

    if (!response.ok) {
      console.error("Falha protegida ao reenviar acesso de membro.", {
        requestId,
        memberId,
        status: response.status,
      });
      return {
        kind: "error",
        message: "Não foi possível reenviar agora. Tente novamente depois.",
      };
    }
  } catch (error) {
    console.error("Falha ao iniciar reenvio da Área da Família.", {
      requestId,
      memberId,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return {
      kind: "error",
      message: "Não foi possível reenviar agora. Tente novamente depois.",
    };
  }

  revalidatePath("/admin/membros");

  return {
    kind: "success",
    message: "Novo e-mail enviado com segurança.",
  };
}
