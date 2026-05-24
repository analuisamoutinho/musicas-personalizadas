// mascotinhos/packages/bot-engine/src/tools/collect-musica-briefing.ts
//
// Ferramenta para coletar briefing de música personalizada.
// Segue o padrão do Mascotinhos: divide em fases, cada fase salva dados e pergunta a próxima coisa.

import { tool } from "ai";
import { z } from "zod";
import prisma from "@mascotinhos/db";
import { updateOrderState } from "../conversation";
import { ORDER_ID_PATTERN } from "../order-id";

const RITMOS_VALIDOS = [
  "pagode",
  "sertanejo",
  "sertanejo_universitario",
  "gospel",
  "arrocha",
  "forró",
  "pop_romântico",
  "pop_romantico",
];

function normalizarRitmo(entrada: string): string {
  const mapa: Record<string, string> = {
    pagode: "PAGODE_ROMANTICO",
    sertanejo: "SERTANEJO_ROMANTICO",
    sertanejo_universitario: "SERTANEJO_UNIVERSITARIO",
    sertanejo_univ: "SERTANEJO_UNIVERSITARIO",
    gospel: "GOSPEL_LEVE",
    arrocha: "SERTANEJO_ROMANTICO", // arrocha → sertanejo
    forró: "SERTANEJO_ROMANTICO",    // forró → sertanejo
    "pop_romântico": "POP_ROMANTICO",
    "pop_romantico": "POP_ROMANTICO",
    pop: "POP_ROMANTICO",
  };

  const normalizado = entrada
    .toLowerCase()
    .trim()
    .replace(/[àáâãäå]/g, "a")
    .replace(/[èéêë]/g, "e")
    .replace(/[ìíîï]/g, "i")
    .replace(/[òóôõö]/g, "o")
    .replace(/[ùúûü]/g, "u");

  return mapa[normalizado] || "SERTANEJO_UNIVERSITARIO"; // default
}

export const collectMusicaBriefing = tool({
  description:
    "Collect music personalization briefing in phases: 'nome' (recipient name), 'historia' (story), 'ritmo' (music style), 'voz' (voice), 'confirmacao' (confirm all)",
  inputSchema: z.object({
    orderId: z.string().regex(ORDER_ID_PATTERN),
    phase: z
      .enum(["nome", "historia", "ritmo", "voz", "confirmacao"])
      .describe(
        "'nome' = save recipient name, ask for story; 'historia' = save story, ask for style; 'ritmo' = save style, ask for voice; 'voz' = save voice, ask for confirmation; 'confirmacao' = save all and proceed to order confirmation",
      ),
    resposta: z
      .string()
      .nullable()
      .describe("Client's response to the current question"),
    fraseFinal: z
      .string()
      .nullable()
      .describe("Optional final phrase client requested (only in 'confirmacao' phase)"),
  }),
  execute: async (input) => {
    const order = await prisma.order.findUnique({
      where: { id: input.orderId },
    });

    if (!order) {
      throw new Error(`Order ${input.orderId} not found`);
    }

    // Marcar como produto de música
    if (order.productType !== "MUSICA_PERSONALIZADA") {
      await prisma.order.update({
        where: { id: input.orderId },
        data: { productType: "MUSICA_PERSONALIZADA" },
      });
    }

    let proximaMensagem = "";

    // ────────────────────────────────────────────────────────────────────────

    if (input.phase === "nome") {
      // Salvou nome do homenageado
      const nome = input.resposta?.trim() || "";

      if (!nome) {
        return {
          sucesso: false,
          mensagem: "Desculpa, não entendi. Pode repetir o nome da pessoa? 😊",
          proximaFase: "nome",
        };
      }

      await prisma.order.update({
        where: { id: input.orderId },
        data: {
          musicaNomeHomenageado: nome,
        },
      });

      proximaMensagem =
        "Perfeito! Agora me conta um pouquinho da história de vocês. Pode falar do jeito que vier na cabeça mesmo: como vocês se conheceram, momentos marcantes, superações, conquistas, características dessa pessoa e qualquer detalhe que você gostaria que aparecesse na música. Quanto mais verdadeiro for o relato, mais emocionante fica a música. ❤️";

      return {
        sucesso: true,
        mensagem: proximaMensagem,
        proximaFase: "historia",
      };
    }

    // ────────────────────────────────────────────────────────────────────────

    if (input.phase === "historia") {
      // Salvou história
      const historia = input.resposta?.trim() || "";

      if (!historia || historia.length < 10) {
        return {
          sucesso: false,
          mensagem:
            "Preciso de mais detalhes! 😊 Pode contar um pouco mais da história? Quanto mais específico, melhor fica a música.",
          proximaFase: "historia",
        };
      }

      await prisma.order.update({
        where: { id: input.orderId },
        data: {
          musicaHistoria: historia,
        },
      });

      proximaMensagem =
        "Que história linda! Já dá pra transformar isso em uma música bem especial. Qual ritmo você prefere? Pode ser pagode, sertanejo, gospel, arrocha, forró, pop romântico ou outro estilo que combine com vocês.";

      return {
        sucesso: true,
        mensagem: proximaMensagem,
        proximaFase: "ritmo",
      };
    }

    // ────────────────────────────────────────────────────────────────────────

    if (input.phase === "ritmo") {
      // Salvou ritmo
      const ritmoEntrada = input.resposta?.trim() || "";

      if (!ritmoEntrada) {
        return {
          sucesso: false,
          mensagem:
            "Qual ritmo você prefere? Pode ser pagode, sertanejo, gospel, arrocha, forró, pop romântico ou outro estilo.",
          proximaFase: "ritmo",
        };
      }

      const ritmoNormalizado = normalizarRitmo(ritmoEntrada);

      await prisma.order.update({
        where: { id: input.orderId },
        data: {
          musicaRitmo: ritmoNormalizado,
        },
      });

      proximaMensagem =
        "Perfeito! Agora só falta saber: a música é pra ser cantada por voz masculina ou feminina?";

      return {
        sucesso: true,
        mensagem: proximaMensagem,
        proximaFase: "voz",
      };
    }

    // ────────────────────────────────────────────────────────────────────────

    if (input.phase === "voz") {
      // Salvou voz
      const vozEntrada = input.resposta?.toLowerCase().trim() || "";

      let vozNormalizada: "MASCULINA" | "FEMININA" = "FEMININA"; // default

      if (
        vozEntrada.includes("masc") ||
        vozEntrada.includes("homem") ||
        vozEntrada.includes("ele")
      ) {
        vozNormalizada = "MASCULINA";
      } else if (
        vozEntrada.includes("fem") ||
        vozEntrada.includes("mulher") ||
        vozEntrada.includes("ela")
      ) {
        vozNormalizada = "FEMININA";
      }

      await prisma.order.update({
        where: { id: input.orderId },
        data: {
          musicaVoz: vozNormalizada,
        },
      });

      proximaMensagem =
        "Perfeito. Vou preparar uma prévia personalizada pra você ouvir. Funciona assim: eu te envio uma prévia da música. Se você gostar, você confirma o pagamento de **R$19,90 via Pix** e eu libero a música completa direto aqui no WhatsApp. Combinado?";

      return {
        sucesso: true,
        mensagem: proximaMensagem,
        proximaFase: "confirmacao",
      };
    }

    // ────────────────────────────────────────────────────────────────────────

    if (input.phase === "confirmacao") {
      // Cliente confirmou tudo
      const resposta = input.resposta?.toLowerCase().trim() || "";

      // Aceitar respostas como "sim", "ok", "combina", "vamo", etc.
      const confirmacaoSinais = [
        "sim",
        "ok",
        "okay",
        "tá bom",
        "combina",
        "vamo",
        "vamos",
        "pode ser",
        "boa",
        "pode ir",
        "pode fazer",
        "tá certo",
        "confirmado",
        "fechado",
      ];

      const confirmou = confirmacaoSinais.some((s) =>
        resposta.includes(s)
      );

      if (!confirmou) {
        return {
          sucesso: false,
          mensagem:
            "Tá certo? A gente segue com esse plano: prévia → seu OK → você paga → libero a música completa.",
          proximaFase: "confirmacao",
        };
      }

      // Salvar frase final se fornecida
      if (input.fraseFinal?.trim()) {
        await prisma.order.update({
          where: { id: input.orderId },
          data: {
            musicaFraseFinal: input.fraseFinal.trim(),
          },
        });
      }

      // Avançar no fluxo conversacional
      const estadoAtual = order.conversationState;

      // Se não está em COLLECTING_MUSICA_BRIEFING ainda, avançar pra lá
      if (estadoAtual === "GREETING") {
        await updateOrderState(
          input.orderId,
          "GREETING",
          "COLLECTING_MUSICA_BRIEFING",
        );
      }

      // Confirmar pedido → prosseguir para pagamento
      try {
        await updateOrderState(
          input.orderId,
          "COLLECTING_MUSICA_BRIEFING",
          "MUSICA_CONFIRMING_ORDER",
        );
      } catch (e) {
        // Se já está em outro estado, tentar ir pra MUSICA_CONFIRMING_ORDER mesmo assim
        await prisma.order.update({
          where: { id: input.orderId },
          data: { conversationState: "MUSICA_CONFIRMING_ORDER" },
        });
      }

      // Disparar geração de letra em background
      dispararGeracaoMusica(input.orderId);

      proximaMensagem =
        "Prontinho, já estou finalizando sua prévia. Assim que eu enviar, escuta com atenção porque será enviado como visualização única e o download só é liberado depois da confirmação do pagamento.";

      return {
        sucesso: true,
        mensagem: proximaMensagem,
        pedidoId: input.orderId,
        proximaFase: "geracao",
      };
    }

    // ────────────────────────────────────────────────────────────────────────

    return {
      sucesso: false,
      mensagem: "Algo deu errado. Pode tentar novamente?",
    };
  },
});

// ─── Disparar geração em background ───────────────────────────────────────

async function dispararGeracaoMusica(orderId: string) {
  // Importar aqui para evitar circular dependency
  const { gerarLetra } = await import("../../../web/src/lib/gerar-letra");

  // Aguardar um pouco para garantir que os dados foram salvos
  await new Promise((resolve) => setTimeout(resolve, 500));

  const order = await prisma.order.findUnique({
    where: { id: orderId },
  });

  if (!order || !order.musicaNomeHomenageado) {
    console.error(`[gerarMusica] Order ${orderId} sem dados completos`);
    return;
  }

  try {
    const briefing = {
      nomeHomenageado: order.musicaNomeHomenageado,
      historia: order.musicaHistoria || "",
      ritmo: (order.musicaRitmo || "SERTANEJO_UNIVERSITARIO") as any,
      voz: (order.musicaVoz || "FEMININA") as any,
      fraseFinal: order.musicaFraseFinal || undefined,
    };

    const letra = await gerarLetra(briefing);

    await prisma.order.update({
      where: { id: orderId },
      data: {
        musicaLetra: letra,
        musicaLetraGeradaEm: new Date(),
      },
    });

    console.log(
      JSON.stringify({
        level: "info",
        event: "musica_letra_gerada",
        orderId,
        service: "bot-engine",
      }),
    );
  } catch (err) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "musica_letra_geracao_falhou",
        orderId,
        erro: String(err),
        service: "bot-engine",
      }),
    );
  }
}
