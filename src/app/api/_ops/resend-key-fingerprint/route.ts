import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const key = process.env.RESEND_API_KEY;

  if (!key) {
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  const fingerprint = createHash("sha256").update(key).digest("hex");
  console.info("[ops] resend-key-fingerprint", { fingerprint });

  return new NextResponse(null, { status: 204 });
}
