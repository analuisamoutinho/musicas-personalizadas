// mascotinhos/apps/web/src/lib/mercadopago-service.ts
//
// Integração com Mercado Pago para geração de PIX e confirmação de pagamento.
// SDK oficial: mercadopago (v2+) — compatível com ESModules e TypeScript.
//
// Instalar: bun add mercadopago

import { MercadoPagoConfig, Payment } from "mercadopago";

const PRECO_MUSICA = Number(process.env.PRECO_MUSICA ?? 19.90);

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN!,
});

const payment = new Payment(client);

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type PixGerado = {
  paymentId: string;
  qrCode: string;          // texto copia-e-cola
  qrCodeBase64?: string;   // imagem em base64 (pode vir vazio em sandbox)
  expiresAt: Date;
};

// ─── Gerar PIX ────────────────────────────────────────────────────────────────

export async function gerarPix(params: {
  orderId: string;
  nomeCliente: string;
  telefoneCliente: string; // WhatsApp sender ID
}): Promise<PixGerado> {

  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/mercadopago`;

  const resposta = await payment.create({
    body: {
      transaction_amount: PRECO_MUSICA,
      payment_method_id:  "pix",
      external_reference: params.orderId,   // ← chave para identificar o pedido no webhook
      notification_url:   webhookUrl,
      payer: {
        first_name: params.nomeCliente || "Cliente",
        email:      `${params.telefoneCliente.replace(/\D/g, "")}@musica.app`,
      },
      // PIX expira em 30 minutos
      date_of_expiration: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    },
  });

  const txData = resposta.point_of_interaction?.transaction_data;

  if (!txData?.qr_code) {
    throw new Error(`Mercado Pago não retornou QR Code: ${JSON.stringify(resposta)}`);
  }

  return {
    paymentId:    String(resposta.id),
    qrCode:       txData.qr_code,
    qrCodeBase64: txData.qr_code_base64 ?? undefined,
    expiresAt:    new Date(Date.now() + 30 * 60 * 1000),
  };
}

// ─── Verificar status de um pagamento ─────────────────────────────────────────
// Usado como fallback se o webhook não chegar (polling)

export async function verificarPagamento(paymentId: string): Promise<"approved" | "pending" | "rejected"> {
  const resposta = await payment.get({ id: paymentId });
  const status   = resposta.status;

  if (status === "approved") return "approved";
  if (status === "rejected" || status === "cancelled") return "rejected";
  return "pending";
}
