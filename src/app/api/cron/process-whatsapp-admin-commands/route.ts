import { NextResponse } from "next/server";
import { processQueuedCasaCommands } from "@/lib/whatsapp-admin-commands";
import { processQueuedCasaBotMessages } from "@/lib/whatsapp-conversation-bot";
import { processQueuedSiteCodeChanges } from "@/lib/site-code-agent-pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  try {
    const commands = await processQueuedCasaCommands(5);
    const conversation = await processQueuedCasaBotMessages(3);
    const visual = await processQueuedSiteCodeChanges();
    return NextResponse.json({ commands, conversation, visual });
  }
  catch (error) {
    console.error("casa_command_cron_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Não foi possível processar os comandos." }, { status: 503 });
  }
}
