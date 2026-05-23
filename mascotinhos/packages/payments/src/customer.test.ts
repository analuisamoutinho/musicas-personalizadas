import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { createOrUpdateCustomer } from './customer';

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

describe('createOrUpdateCustomer', () => {
  beforeEach(() => {
    process.env['NODE_ENV'] = 'test';
  });

  it('returns existing customer id when found by externalReference', async () => {
    global.fetch = makeFetch([
      { status: 200, body: { data: [{ id: 'cus_existing', name: 'Ana' }], totalCount: 1 } },
    ]) as unknown as typeof fetch;

    const result = await createOrUpdateCustomer('5511999999999', 'Ana');
    expect(result.id).toBe('cus_existing');
  });

  it('uses raw phone as externalReference without stripping country code', async () => {
    let getUrl = '';
    let callCount = 0;
    global.fetch = mock((url: string) => {
      callCount++;
      if (callCount === 1) getUrl = url;
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () => Promise.resolve({ data: [{ id: 'cus_found', name: 'Maria' }], totalCount: 1 }),
      });
    }) as unknown as typeof fetch;

    await createOrUpdateCustomer('5521988887777', 'Maria');
    expect(getUrl).toContain('externalReference=5521988887777');
  });

  it('strips leading + from externalReference', async () => {
    let getUrl = '';
    let callCount = 0;
    global.fetch = mock((url: string) => {
      callCount++;
      if (callCount === 1) getUrl = url;
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () => Promise.resolve({ data: [{ id: 'cus_intl', name: 'W' }], totalCount: 1 }),
      });
    }) as unknown as typeof fetch;

    await createOrUpdateCustomer('+5511988887777', 'W');
    expect(getUrl).toContain('externalReference=5511988887777');
    expect(getUrl).not.toContain('%2B');
  });

  it('handles 12-digit Brazilian number without 9-prefix (regression for 553898306870)', async () => {
    let getUrl = '';
    let callCount = 0;
    global.fetch = mock((url: string) => {
      callCount++;
      if (callCount === 1) getUrl = url;
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () => Promise.resolve({ data: [{ id: 'cus_12digit', name: 'Test' }], totalCount: 1 }),
      });
    }) as unknown as typeof fetch;

    await createOrUpdateCustomer('553898306870', 'Test');
    expect(getUrl).toContain('externalReference=553898306870');
  });

  it('treats 404 from GET /customers as not found and creates customer', async () => {
    let callCount = 0;
    global.fetch = mock((_url: string) => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          ok: false,
          status: 404,
          statusText: '',
          text: () => Promise.resolve(''),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () => Promise.resolve({ id: 'cus_created', name: 'Test' }),
      });
    }) as unknown as typeof fetch;

    const result = await createOrUpdateCustomer('553898306870', 'Test');
    expect(result.id).toBe('cus_created');
    expect(callCount).toBe(2);
  });

  it('creates new customer when not found and returns new id', async () => {
    global.fetch = makeFetch([
      { status: 200, body: { data: [], totalCount: 0 } },
      { status: 200, body: { id: 'cus_new', name: 'João' } },
    ]) as unknown as typeof fetch;

    const result = await createOrUpdateCustomer('5511912345678', 'João');
    expect(result.id).toBe('cus_new');
  });

  it('POST body contains only name and externalReference, no phone or mobilePhone', async () => {
    let postBody: unknown;
    let callCount = 0;
    global.fetch = mock((_url: string, opts?: RequestInit) => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: () => Promise.resolve({ data: [], totalCount: 0 }),
        });
      }
      postBody = JSON.parse(opts?.body as string);
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () => Promise.resolve({ id: 'cus_new', name: 'Test' }),
      });
    }) as unknown as typeof fetch;

    await createOrUpdateCustomer('5511912345678', 'Test');
    expect((postBody as Record<string, unknown>).externalReference).toBe('5511912345678');
    expect((postBody as Record<string, unknown>).name).toBe('Test');
    expect((postBody as Record<string, unknown>).phone).toBeUndefined();
    expect((postBody as Record<string, unknown>).mobilePhone).toBeUndefined();
  });

  it('does not make POST when customer already exists', async () => {
    let postCalled = false;
    global.fetch = mock((_url: string, opts?: RequestInit) => {
      if (opts?.method === 'POST') postCalled = true;
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () => Promise.resolve({ data: [{ id: 'cus_abc', name: 'Lucia' }], totalCount: 1 }),
      });
    }) as unknown as typeof fetch;

    await createOrUpdateCustomer('5511911112222', 'Lucia');
    expect(postCalled).toBe(false);
  });
});
