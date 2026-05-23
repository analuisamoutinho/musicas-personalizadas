import { asaasRequest, type AsaasPaymentStatus } from './client';
import type { AsaasSplit } from './split';

export type PixChargeResult = {
  chargeId: string;
  pixQrCodeBase64: string;
  pixCopyPaste: string;
};

type AsaasPixQrCode = {
  encodedImage: string;
  payload: string;
};

type AsaasPaymentResponse = {
  id: string;
  status: AsaasPaymentStatus;
  value: number;
};

type AsaasPaymentListResponse = {
  data: AsaasPaymentResponse[];
  totalCount: number;
};

function tomorrowISO(): string {
  return new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
}

export async function fetchPixQrCode(paymentId: string): Promise<PixChargeResult> {
  const qrCode = await asaasRequest<AsaasPixQrCode>('GET', `/payments/${paymentId}/pixQrCode`);
  if (!qrCode.encodedImage || !qrCode.payload) {
    throw Object.assign(new Error('PIX QR code not ready in Asaas response'), {
      code: 'PIX_QR_NOT_READY',
      retryable: true,
    });
  }
  return {
    chargeId: paymentId,
    pixQrCodeBase64: qrCode.encodedImage,
    pixCopyPaste: qrCode.payload,
  };
}

export async function createPixCharge(
  customerId: string,
  orderId: string,
  amount: number,
  splitConfig?: AsaasSplit[]
): Promise<PixChargeResult> {
  // Idempotency: reuse existing PENDING charge for this orderId
  const existing = await asaasRequest<AsaasPaymentListResponse>(
    'GET',
    `/payments?externalReference=${encodeURIComponent(orderId)}&status=PENDING`
  );

  const existingPayment = existing.data[0];
  if (existingPayment) {
    return fetchPixQrCode(existingPayment.id);
  }

  const payload: Record<string, unknown> = {
    customer: customerId,
    billingType: 'PIX',
    value: amount,
    dueDate: tomorrowISO(),
    description: `Mascotinho - Pedido ${orderId}`,
    externalReference: orderId,
  };

  if (splitConfig && splitConfig.length > 0) {
    payload.split = splitConfig;
  }

  const created = await asaasRequest<AsaasPaymentResponse>('POST', '/payments', payload);
  return fetchPixQrCode(created.id);
}

export async function getPaymentStatus(asaasId: string): Promise<{
  id: string;
  status: AsaasPaymentStatus;
  value: number;
}> {
  const payment = await asaasRequest<AsaasPaymentResponse>('GET', `/payments/${asaasId}`);
  return { id: payment.id, status: payment.status, value: payment.value };
}
