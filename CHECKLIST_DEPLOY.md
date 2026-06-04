// CHECKLIST DE DEPLOY — MÚSICAS PERSONALIZADAS 100% AUTOMATIZADO
// ═════════════════════════════════════════════════════════════════════════════

## FASE 1 — BANCO DE DADOS ✅

- [ ] Adicionar ao `mascotinhos/packages/db/prisma/schema/schema.prisma`:
  - [ ] Enum `ProductType` com valor `MUSICA_PERSONALIZADA`
  - [ ] Novos campos na tabela `Order`:
    - `productType`, `musicaNomeHomenageado`, `musicaVinculo`, `musicaHistoria`
    - `musicaRitmo`, `musicaVoz`, `musicaFraseFinal`
    - `musicaTitulo`, `musicaEstiloDetalhado`, `musicaLetra`, `musicaPromptSuno`
    - `musicaLetraGeradaEm`, `musicaAudioPreviewUrl`, `musicaAudioFinalUrl`
    - `revisoesSolicitadas`
  - [ ] Novo model `MetricaDiaria` (para dashboard)

- [ ] Rodar migrações:
  ```bash
  cd mascotinhos
  bun run db:push
  bun run db:generate
  ```

---

## FASE 2 — LIBS E SERVIÇOS ✅

Copiar estes arquivos para o projeto:

- [ ] `gerar-letra.ts` → `mascotinhos/apps/web/src/lib/`
  - Gera 3 blocos: título, estilo, letra completa, prompt Suno
  
- [ ] `kie-service.ts` → `mascotinhos/apps/web/src/lib/`
  - Dispara geração na Kie.ai, consulta status, aguarda conclusão
  
- [ ] `mercadopago-service.ts` → `mascotinhos/apps/web/src/lib/`
  - Gera PIX, verifica status de pagamento
  
- [ ] `whatsapp-service.ts` → `mascotinhos/apps/web/src/lib/`
  - Envia mensagens, áudios, documentos via WhatsApp Cloud API

---

## FASE 3 — BOT (ATENDIMENTO) ✅

- [ ] `collect-musica-briefing.ts` → `mascotinhos/packages/bot-engine/src/tools/`
  - Ferramenta que coleta: nome → história → ritmo → voz → confirmação
  - Dispara geração em background
  
- [ ] Atualizar `mascotinhos/packages/bot-engine/src/tools/index.ts`:
  ```typescript
  export { collectMusicaBriefing } from "./collect-musica-briefing";
  ```

- [ ] Atualizar `mascotinhos/packages/bot-engine/src/prompts/system-prompt.ts`:
  - Importar `buildMusicaSystemPrompt` de `musica-system-prompt.ts`
  - Adicionar lógica de roteamento: se cliente menciona "música" → usar prompt de música
  - Se menciona "foto"/"desenho" → usar prompt de mascotinho
  
- [ ] Adicionar `musica-system-prompt.ts` → `mascotinhos/packages/bot-engine/src/prompts/`
  - System prompt com 4 etapas exatas + regras de encerramento

---

## FASE 4 — API ROUTES ✅

- [ ] `api-pedidos-route.ts` → `mascotinhos/apps/web/src/app/api/pedidos/route.ts`
  - POST: valida briefing, cria pedido, dispara geração de 3 blocos
  - GET: lista pedidos com status
  
- [ ] `api-pedido-id-route.ts` → `mascotinhos/apps/web/src/app/api/pedidos/[id]/route.ts`
  - GET: retorna pedido completo
  - PATCH: atualiza qualquer campo
  - POST (retentar): regenera letra

- [ ] `webhook-kie-route.ts` → `mascotinhos/apps/web/src/app/api/webhooks/kie/route.ts`
  - Recebe callback da Kie.ai quando áudio fica pronto
  - Salva URL → gera PIX → envia preview + PIX via WhatsApp

- [ ] `webhook-mercadopago-route.ts` → `mascotinhos/apps/web/src/app/api/webhooks/mercadopago/route.ts`
  - Recebe notificação de pagamento aprovado
  - Marca pedido como pago → envia áudio final via WhatsApp

- [ ] `api-dashboard-route.ts` → `mascotinhos/apps/web/src/app/api/dashboard/route.ts`
  - GET: retorna métricas (pedidos, vendas, faturamento, alterações solicitadas)

---

## FASE 5 — UI/PAINEL ✅

- [ ] `painel-pedidos.tsx` → `mascotinhos/apps/web/src/app/painel/page.tsx`
  - Tabela de pedidos com filtro por status
  - Modal com 3 abas:
    - Briefing: nome, vínculo, história, ritmo, voz, frase final
    - Letra: título, estilo (copy), prompt Suno (copy), letra completa (copy)
    - Ações: colar URL preview, colar URL final, marcar como alteração, regenerar
  - Atualização automática a cada 15s

- [ ] `dashboard.tsx` → `mascotinhos/apps/web/src/app/painel/dashboard/page.tsx`
  - Gráfico de investido vs faturado por dia
  - Tabela detalhada com lucro colorido
  - Filtros: 7 dias, 30 dias, mês atual
  - Métricas: leads, conversão, ROAS, custo/lead, alterações solicitadas

---

## FASE 6 — VARIÁVEIS DE AMBIENTE ✅

Adicionar ao `.env.local` (desenvolvimento):
```
KIE_API_KEY=sua-chave-kie
MERCADOPAGO_ACCESS_TOKEN=seu-token-mp
NEXT_PUBLIC_APP_URL=http://localhost:3000

# WhatsApp (já devem existir do Mascotinhos)
WHATSAPP_ACCESS_TOKEN=seu-token
WHATSAPP_PHONE_NUMBER_ID=seu-id
WHATSAPP_WEBHOOK_TOKEN=seu-token-webhook

# OpenAI
OPENAI_API_KEY=sk-...

# Preço
PRECO_MUSICA=19.90
```

Adicionar ao painel da **Vercel** (produção):
```
KIE_API_KEY
MERCADOPAGO_ACCESS_TOKEN
NEXT_PUBLIC_APP_URL=https://seudominio.vercel.app
(resto já deve estar)
```

---

## FASE 7 — WEBHOOKS PÚBLICOS ✅

Configurar URLs públicas para os webhooks:

### Kie.ai
Ao chamar `iniciarGeracaoKie()`, o callback já está no código:
```
https://seudominio.vercel.app/api/webhooks/kie?orderId={orderId}
```
✅ Automático — sem configuração extra

### Mercado Pago
1. Acesse painel do MP → Configurações → Notificações
2. Adicione a URL:
```
https://seudominio.vercel.app/api/webhooks/mercadopago
```
3. Selecione eventos: `payment.updated` e `payment.created`

### WhatsApp (já deve estar configurado do Mascotinhos)
Verificar que o webhook de mensagens está apontando para:
```
https://seudominio.vercel.app/api/webhooks/whatsapp
```
(ou onde estiver no Mascotinhos)

---

## FASE 8 — TESTES ANTES DO DEPLOY ✅

### Teste 1 — Geração de letra (local)
```bash
curl -X POST http://localhost:3000/api/pedidos \
  -H "Content-Type: application/json" \
  -d '{
    "telefone": "seu-numero-whatsapp",
    "nomeHomenageado": "João",
    "vinculo": "pai",
    "historia": "Trabalhamos juntos por 20 anos...",
    "ritmo": "SERTANEJO_UNIVERSITARIO",
    "voz": "MASCULINA"
  }'
```
Espera 5-10s e verifica se a letra foi gerada no banco.

### Teste 2 — Fluxo completo (sandbox)
1. Ativa modo teste do Mercado Pago (credenciais TEST-...)
2. Simula geração na Kie.ai (ou envia uma URL fake de teste)
3. Verifica se PIX foi gerado
4. Simula pagamento no painel do MP (marca como aprovado)
5. Verifica se webhook foi acionado e áudio foi enviado

### Teste 3 — WhatsApp
1. Testa `enviarMensagemWhatsApp()` com um número real
2. Testa `enviarAudioWhatsApp()` com URL real
3. Valida que aparecem no WhatsApp

---

## FASE 9 — SECURITY ✅

- [ ] `.env.local` está no `.gitignore` (não commitar credenciais)
- [ ] Vercel tem as env vars adicionadas (não no código)
- [ ] Webhook do MP retorna sempre `200` (mesmo em erro) para não reenviá indefinidamente
- [ ] Validação de `orderId` em todos os webhooks (não processar sem ID válido)
- [ ] Rate limiting na API de geração (opcional, mas recomendado para evitar abuso)

---

## FASE 10 — DEPLOY ✅

```bash
# Build local para testar
bun run build

# Se OK, fazer push
git add .
git commit -m "feat: sistema 100% automatizado de músicas personalizadas"
git push origin main

# Vercel deploy automático
# ou
vercel --prod
```

---

## FASE 11 — PÓS-DEPLOY ✅

- [ ] Verificar logs da Vercel para erros
- [ ] Testar fluxo completo em produção com credenciais reais
- [ ] Monitorar webhook do Kie.ai (logs em tempo real)
- [ ] Monitorar webhook do MP (confirmar que pagamentos chegam)
- [ ] Testar atendimento via WhatsApp com um número real
- [ ] Marcar como "pronto para clientes" no seu dashboard

---

## CHECKLIST FINAL

- [ ] Banco de dados migrado
- [ ] Todas as libs copiadas
- [ ] Bot atualizado com collectMusicaBriefing
- [ ] System prompt de música adicionado
- [ ] API routes criadas (pedidos, webhooks, dashboard)
- [ ] Painel criado
- [ ] `.env` preenchido (local)
- [ ] Vercel com env vars (produção)
- [ ] Webhooks configurados no MP
- [ ] Testes passando
- [ ] Deploy feito
- [ ] Logs verificados

---

**Tempo estimado:** 2-3 horas (se seguir na ordem)

**Problemas comuns:**
- Webhook do MP não chega → testar com Postman ou webhook.site
- Áudio da Kie vem vazio → verificar se o prompt tem mais de 5000 chars
- WhatsApp não envia → testar token de acesso
- Letra não gera → conferir OPENAI_API_KEY

Qualquer dúvida em alguma fase, me chama! 🚀
