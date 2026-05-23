import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { asaasRequest } from './client';

function makeFetch(status: number, body: unknown) {
  return mock(() =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      statusText: status === 200 ? 'OK' : status === 422 ? 'Unprocessable Entity' : 'Internal Server Error',
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(JSON.stringify(body)),
    })
  );
}

describe('asaasRequest', () => {
  beforeEach(() => {
    process.env['NODE_ENV'] = 'test';
  });

  it('returns parsed JSON on 2xx', async () => {
    global.fetch = makeFetch(200, { id: 'cus_123' }) as unknown as typeof fetch;
    const result = await asaasRequest<{ id: string }>('GET', '/customers?limit=1');
    expect(result.id).toBe('cus_123');
  });

  it('throws AppError with retryable: false on 4xx', async () => {
    global.fetch = makeFetch(422, {
      errors: [{ code: 'invalid.billing.type', description: 'Tipo de cobrança inválido' }],
    }) as unknown as typeof fetch;

    try {
      await asaasRequest('POST', '/payments', {});
      expect(true).toBe(false); // should not reach here
    } catch (err: unknown) {
      const e = err as { retryable: boolean; message: string; code: string };
      expect(e.retryable).toBe(false);
      expect(e.code).toBe('ASAAS_API_ERROR');
      expect(e.message).toBe('Tipo de cobrança inválido');
    }
  });

  it('throws AppError with retryable: true on 5xx', async () => {
    global.fetch = makeFetch(503, {
      errors: [{ code: 'service.unavailable', description: 'Serviço indisponível' }],
    }) as unknown as typeof fetch;

    try {
      await asaasRequest('GET', '/payments/pay_123');
      expect(true).toBe(false);
    } catch (err: unknown) {
      const e = err as { retryable: boolean; code: string };
      expect(e.retryable).toBe(true);
      expect(e.code).toBe('ASAAS_API_ERROR');
    }
  });

  it('falls back to "status statusText" when error body has no errors array', async () => {
    global.fetch = makeFetch(500, {}) as unknown as typeof fetch;

    try {
      await asaasRequest('POST', '/payments', {});
      expect(true).toBe(false);
    } catch (err: unknown) {
      const e = err as { message: string };
      expect(e.message).toBe('500 Internal Server Error');
    }
  });
});
