import { env } from '@mascotinhos/env/server';

export type AppError = {
  code: string;
  message: string;
  orderId?: string;
  status?: number;
  retryable: boolean;
  cause?: unknown;
};

export type AsaasPaymentStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'RECEIVED'
  | 'OVERDUE'
  | 'REFUNDED'
  | 'DELETED'
  | 'AWAITING_RISK_ANALYSIS'
  | 'AWAITING_CHARGEBACK_REVERSAL';

export type AsaasWebhookPayload = {
  event:
    | 'PAYMENT_CONFIRMED'
    | 'PAYMENT_RECEIVED'
    | 'PAYMENT_OVERDUE'
    | 'PAYMENT_DELETED';
  payment: {
    id: string;
    externalReference: string;
    status: AsaasPaymentStatus;
    value: number;
    netValue: number; // Asaas net amount after platform fees
  };
};

function getBaseUrl(): string {
  // ASAAS_SANDBOX=true forces sandbox regardless of deployment environment.
  // Needed because NODE_ENV is always 'production' in Vercel (even preview deploys),
  // and VERCEL_ENV is 'production' on the production deployment used for testing.
  // NOTE: production migrated to https://api.asaas.com/v3 (no /api/ prefix); sandbox
  // still uses /api/v3. The old prod path returns 404 on every authenticated endpoint.
  if (env.ASAAS_SANDBOX === 'true') return 'https://sandbox.asaas.com/api/v3';
  return process.env.VERCEL_ENV === 'production'
    ? 'https://api.asaas.com/v3'
    : 'https://sandbox.asaas.com/api/v3';
}

export async function asaasRequest<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const url = `${getBaseUrl()}${path}`;
  const response = await fetch(url, {
    method,
    headers: {
      access_token: env.ASAAS_API_KEY,
      'Content-Type': 'application/json',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const rawBody = await response.text();
    let message = `${response.status}${response.statusText ? ` ${response.statusText}` : ''}`;
    try {
      const errorBody = JSON.parse(rawBody) as {
        errors?: { code: string; description: string }[];
      };
      if (errorBody.errors?.[0]?.description) {
        message = errorBody.errors[0].description;
      }
    } catch {
      // use status fallback
    }

    console.log(
      JSON.stringify({
        level: 'warn',
        event: 'asaas_api_error',
        status: response.status,
        url,
        path,
        keyPrefix: env.ASAAS_API_KEY.slice(0, 12) + '...',
        message,
        body: rawBody.slice(0, 300),
      })
    );

    throw Object.assign(new Error(message), {
      code: 'ASAAS_API_ERROR',
      status: response.status,
      retryable: response.status >= 500,
      cause: undefined,
    } as AppError);
  }

  return response.json() as Promise<T>;
}
