import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { normalizeWhatsappPhone } from "@/lib/whatsapp";

const ONE_TIME_TOKEN = "manual-wa-20260812-09d38f61";

export async function GET(request: Request) {
  if (request.headers.get("x-import-token") !== ONE_TIME_TOKEN) {
    return Response.json({ error: "Não autorizado." }, { status: 401 });
  }
  const service = getSupabaseServiceClient();
  const { data, error } = await service.from("member_profiles").select("full_name,phone").order("full_name");
  if (error) return Response.json({ error: "Falha ao carregar membros." }, { status: 500 });
  const recipients = new Map<string, string>();
  for (const member of data ?? []) {
    const phone = normalizeWhatsappPhone(member.phone);
    if (phone && !recipients.has(phone)) recipients.set(phone, member.full_name || "Membro");
  }
  return Response.json({ profiles: data?.length ?? 0, recipients: Array.from(recipients, ([phone, name]) => ({ phone, name })) });
}
