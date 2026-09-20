import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { createPagBankEventPayment } from "@/lib/pagbank";
import { getSupabaseRouteClient } from "@/lib/supabase/route";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OWNER_USER_ID = "34944370-8853-4c1b-866b-8c80b4e59829";

export async function POST(request: NextRequest) {
  const { supabase, applyAuthState } = getSupabaseRouteClient(request);
  const respond = (body: Record<string, unknown>, init?: ResponseInit) =>
    applyAuthState(NextResponse.json(body, init));
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || user.id !== OWNER_USER_ID) {
    return respond({ error: "Teste restrito ao Pastor Rilldy." }, { status: 403 });
  }

  const payload = await request.json().catch(() => null);
  const taxId = typeof payload?.taxId === "string" ? payload.taxId.replace(/\D/g, "") : "";
  if (taxId.length !== 11) {
    return respond({ error: "Informe um CPF válido para gerar o Pix de teste." }, { status: 400 });
  }

  const service = getSupabaseServiceClient();
  const { data: profile } = await service
    .from("member_profiles")
    .select("full_name,email,phone,is_admin,approval_status")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile?.is_admin || profile.approval_status !== "approved") {
    return respond({ error: "A conta administrativa não está aprovada." }, { status: 403 });
  }

  try {
    const payment = await createPagBankEventPayment({
      paymentId: randomUUID(),
      eventTitle: "Hambúrguer da Casa · teste PagBank",
      amountCents: 2_000,
      payerName: profile.full_name,
      payerEmail: profile.email,
      payerPhone: profile.phone,
      taxId,
      method: "pix",
    });

    return respond({
      ok: true,
      amountCents: 2_000,
      providerOrderId: payment.providerOrderId,
      providerPaymentId: payment.providerPaymentId,
      pixQrCode: payment.qrCode,
      pixQrCodeBase64: payment.qrCodeBase64,
      expiresInHours: 24,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha desconhecida.";
    console.error("pagbank_owner_test_pix_failed", { message });
    return respond({ error: message }, { status: 502 });
  }
}
