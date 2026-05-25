import { NextRequest, NextResponse } from "next/server";

// Verificação do webhook pelo Meta
export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get("hub.mode");
  const token = req.nextUrl.searchParams.get("hub.verify_token");
  const challenge = req.nextUrl.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_WEBHOOK_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ erro: "Token inválido" }, { status: 403 });
}

// Recebe mensagens do WhatsApp
export async function POST(req: NextRequest) {
  const body = await req.json();
  console.log("[whatsapp-webhook]", JSON.stringify(body));
  return NextResponse.json({ recebido: true });
}
