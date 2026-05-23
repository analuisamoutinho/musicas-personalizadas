import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { createPixCharge, getPaymentStatus } from './create-pix';

const ORDER_ID = 'order-abc-123';
const CUSTOMER_ID = 'cus_123';
const AMOUNT = 29.9;

const QR_CODE = { encodedImage: 'base64==', payload: 'emv_code' };

function makeFetch(responses: { status: number; body: unknown }[]) {
  let callCount = 0;
  return mock(() => {
    const idx = callCount < responses.length ? callCount : responses.length - 1;
    const r = responses[idx] as { status: number; body: unknown };
    callCount++;
    return Promise.resolve({
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      statusText: 'OK',
      json: () => Promise.resolve(r.body),
      text: () => Promise.resolve(JSON.stringify(r.body)),
    });
  });
}

describe('createPixCharge', () => {
  beforeEach(() => {
    process.env['NODE_ENV'] = 'test';
  });

  it('creates new charge and fetches QR code from dedicated endpoint', async () => {
    global.fetch = makeFetch([
      { status: 200, body: { data: [], totalCount: 0 } },                          // GET /payments list
      { status: 200, body: { id: 'pay_new', status: 'PENDING', value: 29.9 } },   // POST /payments
      { status: 200, body: QR_CODE },                                               // GET /payments/pay_new/pixQrCode
    ]) as unknown as typeof fetch;

    const result = await createPixCharge(CUSTOMER_ID, ORDER_ID, AMOUNT);
    expect(result.chargeId).toBe('pay_new');
    expect(result.pixQrCodeBase64).toBe('base64==');
    expect(result.pixCopyPaste).toBe('emv_code');
  });

  it('reuses existing PENDING charge and fetches QR code without POST', async () => {
    let postCalled = false;
    let callCount = 0;
    global.fetch = mock((_url: string, opts?: RequestInit) => {
      callCount++;
      if (opts?.method === 'POST') postCalled = true;
      const body = callCount === 1
        ? { data: [{ id: 'pay_existing', status: 'PENDING', value: 29.9 }], totalCount: 1 }
        : QR_CODE;
      return Promise.resolve({
        ok: true, status: 200, statusText: 'OK',
        json: () => Promise.resolve(body),
        text: () => Promise.resolve(JSON.stringify(body)),
      });
    }) as unknown as typeof fetch;

    const result = await createPixCharge(CUSTOMER_ID, ORDER_ID, AMOUNT);
    expect(result.chargeId).toBe('pay_existing');
    expect(result.pixCopyPaste).toBe('emv_code');
    expect(postCalled).toBe(false);
    expect(callCount).toBe(2); // GET list + GET pixQrCode
  });

  it('throws PIX_QR_NOT_READY with retryable: true when pixQrCode endpoint returns empty', async () => {
    global.fetch = makeFetch([
      { status: 200, body: { data: [], totalCount: 0 } },
      { status: 200, body: { id: 'pay_no_qr', status: 'PENDING', value: 29.9 } },
      { status: 200, body: {} },
    ]) as unknown as typeof fetch;

    try {
      await createPixCharge(CUSTOMER_ID, ORDER_ID, AMOUNT);
      expect(true).toBe(false);
    } catch (err: unknown) {
      const e = err as { code: string; retryable: boolean };
      expect(e.code).toBe('PIX_QR_NOT_READY');
      expect(e.retryable).toBe(true);
    }
  });

  it('includes splitConfig in POST body when provided', async () => {
    let capturedBody: unknown;
    let callCount = 0;
    global.fetch = mock((_url: string, opts?: RequestInit) => {
      callCount++;
      if (opts?.method === 'POST') capturedBody = JSON.parse(opts?.body as string);
      let body: unknown;
      if (callCount === 1) body = { data: [], totalCount: 0 };
      else if (callCount === 2) body = { id: 'pay_split', status: 'PENDING', value: 29.9 };
      else body = QR_CODE;
      return Promise.resolve({
        ok: true, status: 200, statusText: 'OK',
        json: () => Promise.resolve(body),
        text: () => Promise.resolve(JSON.stringify(body)),
      });
    }) as unknown as typeof fetch;

    await createPixCharge(CUSTOMER_ID, ORDER_ID, AMOUNT, [{ walletId: 'w_123', percentualValue: 10 }]);
    expect((capturedBody as { split: unknown[] }).split).toEqual([{ walletId: 'w_123', percentualValue: 10 }]);
  });
});

describe('getPaymentStatus', () => {
  it('returns id, status, and value', async () => {
    global.fetch = makeFetch([
      { status: 200, body: { id: 'pay_abc', status: 'RECEIVED', value: 29.9 } },
    ]) as unknown as typeof fetch;

    const result = await getPaymentStatus('pay_abc');
    expect(result.id).toBe('pay_abc');
    expect(result.status).toBe('RECEIVED');
    expect(result.value).toBe(29.9);
  });

  it('propagates AppError on API failure', async () => {
    global.fetch = makeFetch([
      { status: 404, body: { errors: [{ code: 'not.found', description: 'Cobrança não encontrada' }] } },
    ]) as unknown as typeof fetch;

    try {
      await getPaymentStatus('pay_nonexistent');
      expect(true).toBe(false);
    } catch (err: unknown) {
      const e = err as { retryable: boolean; message: string };
      expect(e.retryable).toBe(false);
      expect(e.message).toBe('Cobrança não encontrada');
    }
  });
});
