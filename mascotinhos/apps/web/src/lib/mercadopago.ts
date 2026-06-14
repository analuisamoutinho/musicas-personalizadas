/**
 * Minimal Mercado Pago PIX helper for web orders.
 * Uses the /v1/payments endpoint with payment_method_id: "pix".
 */

export interface MpPixResult {
  paymentId: string;
  pixCopyPaste: string;
  pixQrCodeBase64: string;
  status: string;
}

export async function createMpPixCharge(
  email: string,
  orderId: string,
  amount: number,
): Promise<MpPixResult> {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) throw new Error("MERCADOPAGO_ACCESS_TOKEN não configurado");

  const body = {
    transaction_amount: amount,
    description: `Música personalizada - pedido ${orderId}`,
    payment_method_id: "pix",
    payer: { email },
    external_reference: orderId,
    notification_url: `${getBaseUrl()}/api/webhooks/mercadopago`,
  };

  const res = await fetch("https://api.mercadopago.com/v1/payments", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": orderId,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Mercado Pago PIX error ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json() as {
    id: number;
    status: string;
    point_of_interaction?: {
      transaction_data?: {
        qr_code?: string;
        qr_code_base64?: string;
      };
    };
  };

  const txData = data.point_of_interaction?.transaction_data;
  if (!txData?.qr_code || !txData?.qr_code_base64) {
    throw new Error("Resposta do Mercado Pago sem QR code PIX");
  }

  return {
    paymentId: String(data.id),
    pixCopyPaste: txData.qr_code,
    pixQrCodeBase64: txData.qr_code_base64,
    status: data.status,
  };
}

function getBaseUrl(): string {
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3001";
}
