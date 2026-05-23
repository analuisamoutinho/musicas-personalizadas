import { asaasRequest } from './client';

type AsaasCustomerListResponse = {
  data: { id: string; name: string }[];
  totalCount: number;
};

type AsaasCustomerCreateResponse = {
  id: string;
  name: string;
};

// Valid-format placeholder CPF. Asaas requires cpfCnpj on every customer used
// for PIX charges in BOTH sandbox AND production — earlier code only set it in
// sandbox, which broke prod with "Para criar esta cobrança é necessário preencher
// o CPF ou CNPJ do cliente." MVP uses a placeholder; collect real CPF from users
// before billing real money in production.
const DEFAULT_CPF = '00000000191';

export async function createOrUpdateCustomer(
  phone: string,
  name: string
): Promise<{ id: string }> {
  const externalRef = phone.startsWith('+') ? phone.slice(1) : phone;

  let existingId: string | undefined;
  try {
    const list = await asaasRequest<AsaasCustomerListResponse>(
      'GET',
      `/customers?externalReference=${encodeURIComponent(externalRef)}&limit=1`
    );
    existingId = list.data[0]?.id;
  } catch (err: unknown) {
    const e = err as { code?: string; status?: number };
    // Asaas returns 404 (empty body) when no customers match the filter — treat as not found
    if (!(e.code === 'ASAAS_API_ERROR' && e.status === 404)) throw err;
  }

  if (existingId) {
    // Patch existing customer to ensure cpfCnpj is set (legacy customers were
    // created without it and would fail charge creation otherwise).
    await asaasRequest('PUT', `/customers/${existingId}`, {
      name,
      externalReference: externalRef,
      cpfCnpj: DEFAULT_CPF,
    });
    return { id: existingId };
  }

  const created = await asaasRequest<AsaasCustomerCreateResponse>('POST', '/customers', {
    name,
    externalReference: externalRef,
    cpfCnpj: DEFAULT_CPF,
  });
  return { id: created.id };
}
