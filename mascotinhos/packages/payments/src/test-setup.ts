// Sets minimum required env vars for unit tests in the payments package.
// This preload runs before any test module is loaded, so even if a real
// module (not mocked) touches @mascotinhos/env/server, it won't throw.
process.env['DATABASE_URL'] = 'postgresql://test:test@localhost:5432/test';
process.env['DIRECT_URL'] = 'postgresql://test:test@localhost:5432/test';
process.env['SUPABASE_URL'] = 'http://localhost:54321';
process.env['SUPABASE_SERVICE_ROLE_KEY'] = 'test-service-role-key';
process.env['OPENAI_API_KEY'] = 'sk-test-key-for-unit-tests';
process.env['ASAAS_API_KEY'] = 'test-asaas-key';
process.env['ASAAS_WEBHOOK_SECRET'] = 'test-asaas-secret';
process.env['WHATSAPP_WEBHOOK_TOKEN'] = 'test-whatsapp-token';
process.env['WHATSAPP_PHONE_NUMBER_ID'] = '123456789';
process.env['WHATSAPP_APP_SECRET'] = 'test-whatsapp-app-secret';
process.env['WHATSAPP_ACCESS_TOKEN'] = 'test-whatsapp-access';
process.env['QSTASH_TOKEN'] = 'test-qstash-token';
process.env['QSTASH_CURRENT_SIGNING_KEY'] = 'sig_test_current';
process.env['QSTASH_NEXT_SIGNING_KEY'] = 'sig_test_next';
process.env['VERCEL_URL'] = 'test.vercel.app';
process.env['OPERATOR_WHATSAPP_NUMBER'] = '5511999999999';
process.env['UPSTASH_REDIS_REST_URL'] = 'https://test.upstash.io';
process.env['UPSTASH_REDIS_REST_TOKEN'] = 'test-upstash-token';
process.env['CRON_SECRET'] = 'test-cron-secret';
process.env['NODE_ENV'] = 'test';
