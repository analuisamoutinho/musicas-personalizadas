// GUIA DE INTEGRAÇÃO: Mascotinhos → Músicas Personalizadas
// ═════════════════════════════════════════════════════════════════════════════

## 1. ENTENDER A ARQUITETURA EXISTENTE

O Mascotinhos usa:
- **Chat SDK** (Anthropic) com adapter WhatsApp
- **Bot Engine** (`packages/bot-engine/`) — máquina de estados que coleta briefing
- **Prisma ORM** para persistência
- **Conversation State Machine** — GREETING → COLLECTING_* → CONFIRMING → PAYMENT → GENERATING → DELIVERING

Cada "order" é uma conversa:
1. Cliente entra (GREETING)
2. Bot coleta dados específicos do produto (COLLECTING_PHOTOS, COLLECTING_THEME, etc.)
3. Cliente confirma (CONFIRMING_ORDER)
4. Cliente paga (AWAITING_PAYMENT)
5. Geração acontece (GENERATING)
6. Entrega (DELIVERING)
7. Fim (COMPLETED)

---

## 2. ADAPTAR PARA MÚSICAS

### 2.1 Schema do Banco

Adicionar ao `mascotinhos/packages/db/prisma/schema/schema.prisma`:

```prisma
// Enum para tipo de produto
enum ProductType {
  MASCOTINHO
  MUSICA_PERSONALIZADA  // ← novo
}

// Atualizar Order para suportar ambos
model Order {
  // ... campos existentes ...
  
  // NOVO: tipo do produto para distinguir lógica por tipo
  productType ProductType @default(MASCOTINHO)
  
  // NOVO: campos específicos de música
  musicaNomeHomenageado String?
  musicaHistoria        String?         @db.Text
  musicaRitmo           String?         // "SERTANEJO_UNIVERSITARIO", etc.
  musicaVoz             String?         // "MASCULINA" ou "FEMININA"
  musicaFraseFinal      String?         // frase específica pedida
  musicaLetra           String?         @db.Text  // letra gerada
  musicaLetraGeradaEm   DateTime?
  musicaAudioPreviewUrl String?
  musicaAudioFinalUrl   String?
  revisoesSolicitadas   Int             @default(0)
}

// NOVO: métricas diárias (para dashboard)
model MetricaDiaria {
  id        String   @id @default(cuid())
  data      DateTime @unique
  diaSemana String?
  investido Float    @default(0)
  leads     Int      @default(0)
  
  @@index([data])
}
```

Depois rodar:
```bash
cd mascotinhos
bun run db:push
bun run db:generate
```

### 2.2 Enum de ConversationState

Adicionar novos estados para o fluxo de música:

```prisma
enum ConversationState {
  // ... estados existentes ...
  
  // NOVO: fluxo de música
  COLLECTING_MUSICA_BRIEFING      // coleta nome, história, ritmo, voz
  MUSICA_CONFIRMING_ORDER
  MUSICA_AWAITING_PREVIEW_APPROVAL // lead aprovou o preview?
  MUSICA_REVISION_REQUESTED        // pedido alteração
  MUSICA_COMPLETED
}
```

---

## 3. CRIAR A FERRAMENTA DE COLETA DO BRIEFING

Arquivo: `mascotinhos/packages/bot-engine/src/tools/collect-musica-briefing.ts`

```typescript
import { tool } from "ai";
import { z } from "zod";
import prisma from "@mascotinhos/db";
import { updateOrderState } from "../conversation";
import { ORDER_ID_PATTERN } from "../order-id";

export const collectMusicaBriefing = tool({
  description:
    "Collect music personalization briefing: name of person being honored, story/details, music style, and voice preference",
  inputSchema: z.object({
    orderId: z.string().regex(ORDER_ID_PATTERN),
    nomeHomenageado: z.string().describe("Name of person being honored"),
    historia: z.string().describe("Story/details/message to include in the music"),
    ritmo: z
      .enum([
        "SERTANEJO_UNIVERSITARIO",
        "SERTANEJO_ROMANTICO",
        "PAGODE_ROMANTICO",
        "POP_ROMANTICO",
        "GOSPEL_LEVE",
      ])
      .describe("Music style preference"),
    voz: z
      .enum(["MASCULINA", "FEMININA"])
      .describe("Voice preference (masculine or feminine)"),
    fraseFinal: z.string().nullable().describe("Optional final phrase client requested"),
  }),
  execute: async (input) => {
    // Salvar briefing
    await prisma.order.update({
      where: { id: input.orderId },
      data: {
        productType: "MUSICA_PERSONALIZADA",
        musicaNomeHomenageado: input.nomeHomenageado,
        musicaHistoria: input.historia,
        musicaRitmo: input.ritmo,
        musicaVoz: input.voz,
        musicaFraseFinal: input.fraseFinal,
      },
    });

    // Avançar no fluxo conversacional
    await updateOrderState(
      input.orderId,
      "COLLECTING_MUSICA_BRIEFING",
      "MUSICA_CONFIRMING_ORDER",
    );

    return {
      success: true,
      message: "Briefing da música salvo com sucesso!",
    };
  },
});
```

Adicionar ao `mascotinhos/packages/bot-engine/src/tools/index.ts`:
```typescript
export { collectMusicaBriefing } from "./collect-musica-briefing";
```

---

## 4. CRIAR WEBHOOK PARA DISPARAR GERAÇÃO

Arquivo: `mascotinhos/apps/web/src/app/api/webhook/ordem-confirmada/route.ts`

Este webhook é chamado quando o cliente confirma o pedido (depois do briefing):

```typescript
import { NextRequest, NextResponse } from "next/server";
import prisma from "@mascotinhos/db";
import { gerarLetra } from "@/lib/gerar-letra";
import type { BriefingMusica } from "@/lib/gerar-letra";

export async function POST(req: NextRequest) {
  try {
    const { orderId } = await req.json();

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.productType !== "MUSICA_PERSONALIZADA") {
      return NextResponse.json({ erro: "Pedido não encontrado" }, { status: 404 });
    }

    // Disparar geração em background
    gerarMusicaEmBackground(orderId, {
      nomeHomenageado: order.musicaNomeHomenageado!,
      historia: order.musicaHistoria!,
      ritmo: order.musicaRitmo as BriefingMusica["ritmo"],
      voz: order.musicaVoz as BriefingMusica["voz"],
      fraseFinal: order.musicaFraseFinal ?? undefined,
    });

    return NextResponse.json({ sucesso: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ erro: "Erro interno" }, { status: 500 });
  }
}

async function gerarMusicaEmBackground(orderId: string, briefing: BriefingMusica) {
  try {
    const letra = await gerarLetra(briefing);

    await prisma.order.update({
      where: { id: orderId },
      data: {
        musicaLetra: letra,
        musicaLetraGeradaEm: new Date(),
      },
    });

    console.log(`[Letra gerada] pedido ${orderId}`);
  } catch (err) {
    console.error(`[Erro ao gerar letra] pedido ${orderId}:`, err);
  }
}
```

---

## 5. ATUALIZAR O SYSTEM PROMPT DO BOT

Arquivo: `mascotinhos/packages/bot-engine/src/prompts/system-prompt.ts`

Adicionar lógica de roteamento para detectar se o cliente quer música:

```typescript
// No system prompt, adicionar:

const rotas = \`
Se o cliente mencionar:
- "música", "música personalizada", "generar canción", "fazer uma música"
  → Rotear para COLLECTING_MUSICA_BRIEFING
  → Perguntar: nome do homenageado, história/motivo, ritmo preferido, voz
  
Se o cliente mencionar:
- "foto", "ilustração", "desenho", "artwork"
  → Rotear para fluxo MASCOTINHO existente
\`;
```

---

## 6. CRIAR PÁGINA NO PAINEL PARA MÚSICAS

Arquivo: `mascotinhos/apps/web/src/app/painel-musicas/page.tsx`

Use o painel que criamos anteriormente (`painel-pedidos.tsx`):
- Renomear para refletir músicas
- Ajustar campos para `musicaNomeHomenageado`, `musicaRitmo`, etc.
- Adicionar aba para colar URL do Suno
- Dashboard com métricas

---

## 7. FLUXO COMPLETO

1. **Lead chama no WhatsApp**: "Quero uma música personalizada para meu pai"
2. **Bot detecta intenção**: Entra em COLLECTING_MUSICA_BRIEFING
3. **Bot coleta**:
   - Nome do homenageado: "João Carlos"
   - História: "Ele trabalhou 40 anos como professor..."
   - Ritmo: "Sertanejo universitário"
   - Voz: "Masculina"
4. **Cliente confirma**: MUSICA_CONFIRMING_ORDER
5. **Sistema dispara**:
   - Chama OpenAI → gera letra
   - Salva letra no banco (musicaLetra)
6. **Você (no painel)**:
   - Vê pedido com status "Letra gerada"
   - Copia a letra
   - Cola no Suno, gera áudio
   - Cola URL do Suno no painel
7. **Sistema envia preview** via WhatsApp (link protegido)
8. **Cliente aprova** ou pede alteração
9. **Cliente paga** → libera áudio final

---

## 8. PROTEGER ROTAS

Adicione middleware em `mascotinhos/apps/web/src/middleware.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";

const PAINEL_SENHA = process.env.PAINEL_SENHA;

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/painel")) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${PAINEL_SENHA}`) {
      return NextResponse.json({ erro: "Não autorizado" }, { status: 401 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/painel/:path*"],
};
```

---

## 9. ENV VARS NOVOS

Adicionar em `.env`:

```
OPENAI_API_KEY=sk-...
PAINEL_SENHA=sua-senha-forte
PRECO_MUSICA=19.90
```

Atualizar `packages/env/src/server.ts`:

```typescript
export const env = z.object({
  // ... existentes ...
  OPENAI_API_KEY: z.string(),
  PAINEL_SENHA: z.string(),
  PRECO_MUSICA: z.number().default(19.90),
}).parse(process.env);
```

---

## 10. CHECKLIST DE IMPLEMENTAÇÃO

- [ ] Schema Prisma atualizado (ProductType, campos de música, MetricaDiaria)
- [ ] `bun run db:push && bun run db:generate`
- [ ] `gerar-letra.ts` adicionado em `apps/web/src/lib/`
- [ ] API routes (`/api/pedidos`, `/api/pedidos/:id`, `/api/dashboard`) criadas
- [ ] `collect-musica-briefing.ts` criado e exportado
- [ ] Webhook de geração (`/api/webhook/ordem-confirmada`) criado
- [ ] Painel de gestão em `/app/painel` (ou `/app/painel-musicas`)
- [ ] Dashboard em `/app/painel/dashboard`
- [ ] System prompt do bot atualizado com lógica de roteamento
- [ ] Middleware de segurança em `/middleware.ts`
- [ ] Env vars adicionadas
- [ ] Testes básicos de fluxo

---

## 11. PRÓXIMAS ETAPAS OPCIONAIS

- [ ] Integração automática com Meta Ads API para preencher `MetricaDiaria`
- [ ] Integração com Suno API (quando abrir)
- [ ] Sistema de revisões automáticas (se alterar, incrementar contador)
- [ ] Webhooks de Mercado Pago para confirmar pagamento automaticamente
- [ ] Notificações por SMS para você quando letra estiver pronta

---

**Obs**: Este guia assume que você já tem o Mascotinhos clonado e rodando localmente.
Para dúvidas, consulte o CLAUDE.md do projeto.
