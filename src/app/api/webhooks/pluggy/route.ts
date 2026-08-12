import { after } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { syncPluggyItem } from "@/lib/open-finance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PluggyEvent = { event?: unknown; eventId?: unknown; itemId?: unknown; transactionIds?: unknown };

export async function POST(request: Request) {
  const expectedSecret = process.env.PLUGGY_WEBHOOK_SECRET?.trim();
  if (!expectedSecret || request.headers.get("x-open-finance-secret") !== expectedSecret) {
    return Response.json({ ok: false }, { status: 401 });
  }
  const payload = await request.json().catch(() => ({})) as PluggyEvent;
  const eventId = typeof payload.eventId === "string" ? payload.eventId : "";
  const eventType = typeof payload.event === "string" ? payload.event : "";
  const itemId = typeof payload.itemId === "string" ? payload.itemId : "";
  if (!eventId || !eventType) return Response.json({ ok: false }, { status: 400 });

  const service = getSupabaseServiceClient();
  const { error } = await service.from("finance_open_finance_events").insert({ provider_event_id: eventId, event_type: eventType, provider_item_id: itemId || null });
  if (error?.code === "23505") return Response.json({ ok: true, duplicate: true });
  if (error) return Response.json({ ok: false }, { status: 503 });

  after(async () => {
    try {
      if (eventType === "transactions/deleted" && Array.isArray(payload.transactionIds)) {
        const ids = payload.transactionIds.filter((id): id is string => typeof id === "string");
        if (ids.length) await service.from("finance_bank_transactions").delete().in("provider_transaction_id", ids);
      } else if (itemId && ["item/created", "item/updated", "transactions/created", "transactions/updated"].includes(eventType)) {
        const { data: connection } = await service.from("finance_bank_connections").select("created_by").eq("provider_item_id", itemId).maybeSingle();
        await syncPluggyItem(itemId, connection?.created_by ?? null);
      } else if (itemId && eventType === "item/error") {
        await service.from("finance_bank_connections").update({ status: "error", error_code: "provider_item_error", updated_at: new Date().toISOString() }).eq("provider_item_id", itemId);
      }
      await service.from("finance_open_finance_events").update({ processed_at: new Date().toISOString() }).eq("provider_event_id", eventId);
    } catch (eventError) {
      await service.from("finance_open_finance_events").update({ error_message: eventError instanceof Error ? eventError.message.slice(0, 500) : "processing_error" }).eq("provider_event_id", eventId);
    }
  });
  return Response.json({ ok: true }, { status: 202 });
}
