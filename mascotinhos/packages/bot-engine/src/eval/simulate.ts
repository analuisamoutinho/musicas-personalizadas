#!/usr/bin/env bun
/**
 * CLI Conversation Simulator for the Músicas Personalizadas bot agent.
 *
 * Calls processMessage() directly — no WhatsApp, no database.
 * Shows tool calls, state transitions, and agent responses.
 *
 * Usage:
 *   bun run simulate:chat                    # interactive mode
 *   bun run simulate:chat -- --scenario happy # run a scripted scenario
 *
 * The simulator mocks all external dependencies (Prisma, Supabase storage,
 * QStash, WhatsApp API) so it runs fully locally with just an OPENAI_API_KEY.
 */

// ── Environment setup (must happen before any import) ──
process.env["DATABASE_URL"] ??= "postgresql://test:test@localhost:5432/test";
process.env["DIRECT_URL"] ??= "postgresql://test:test@localhost:5432/test";
process.env["SUPABASE_URL"] ??= "http://localhost:54321";
process.env["SUPABASE_SERVICE_ROLE_KEY"] ??= "test-service-role-key";
process.env["ASAAS_API_KEY"] ??= "test-asaas-key";
process.env["ASAAS_WEBHOOK_SECRET"] ??= "test-asaas-secret";
process.env["WHATSAPP_WEBHOOK_TOKEN"] ??= "test-whatsapp-token";
process.env["WHATSAPP_APP_SECRET"] ??= "test-whatsapp-app-secret";
process.env["WHATSAPP_PHONE_NUMBER_ID"] ??= "123456789";
process.env["WHATSAPP_ACCESS_TOKEN"] ??= "test-whatsapp-access";
process.env["QSTASH_TOKEN"] ??= "test-qstash-token";
process.env["QSTASH_CURRENT_SIGNING_KEY"] ??= "sig_test_current";
process.env["QSTASH_NEXT_SIGNING_KEY"] ??= "sig_test_next";
process.env["VERCEL_URL"] ??= "https://test.vercel.app";
process.env["OPERATOR_WHATSAPP_NUMBER"] ??= "5511999999999";
process.env["UPSTASH_REDIS_REST_URL"] ??= "https://test.upstash.io";
process.env["UPSTASH_REDIS_REST_TOKEN"] ??= "test-redis-token";
process.env["CRON_SECRET"] ??= "test-cron-secret";
process.env["NODE_ENV"] ??= "test";

// ── Mock external modules before importing bot code ──
import { mock } from "bun:test";

// Mock Prisma
const mockOrder = {
  id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  clientId: "11111111-2222-3333-4444-555555555555",
  conversationState: "GREETING",
  theme: null as string | null,
  outfitDescription: null as string | null,
  extraRequests: null as string | null,
  photosUrls: [] as string[],
  price: 29.9,
  orderStatus: "PENDING",
  client: {
    id: "11111111-2222-3333-4444-555555555555",
    name: null as string | null,
    whatsappSenderId: "5511999999999",
    consentTimestamp: null as Date | null,
  },
};

const mockPrisma = {
  order: {
    findUnique: async () => ({ ...mockOrder }),
    findFirst: async () => null,
    update: async (args: { data: Record<string, unknown> }) => {
      Object.assign(mockOrder, args.data);
      return { ...mockOrder };
    },
    updateMany: async () => ({ count: 1 }),
    create: async () => ({ ...mockOrder }),
  },
  client: {
    upsert: async () => mockOrder.client,
    update: async () => mockOrder.client,
  },
  styleTemplate: {
    findMany: async () => [
      { id: "st-1", name: "Disney", slug: "disney", popularity: 100 },
      { id: "st-2", name: "Herói", slug: "heroi", popularity: 80 },
      { id: "st-3", name: "Outro", slug: "outro", popularity: 50 },
    ],
    update: async () => ({}),
  },
  generation: {
    updateMany: async () => ({ count: 1 }),
    create: async () => ({}),
  },
  payment: {
    findFirst: async () => null,
    create: async () => ({}),
  },
  $transaction: async (ops: Promise<unknown>[]) => {
    for (const op of ops) await op;
  },
};

mock.module("@mascotinhos/db", () => ({
  default: mockPrisma,
  __esModule: true,
}));

mock.module("@mascotinhos/storage", () => ({
  uploadReference: async () => "mocked-storage-path/photo.jpg",
}));

mock.module("@mascotinhos/payments", () => ({
  createOrUpdateCustomer: async () => ({ id: "cust_mock" }),
  createPixCharge: async () => ({
    chargeId: "chg_mock",
    pixCopyPaste: "00020126360014BR.GOV.BCB.PIX...",
    pixQrCodeBase64: "data:image/png;base64,mock...",
  }),
  buildSplitConfig: () => undefined,
}));

mock.module("@upstash/qstash", () => ({
  Client: class {
    async publishJSON() {
      return { messageId: "mock-msg-id" };
    }
  },
}));

// ── Now import bot code (after mocks are in place) ──
import { processMessage } from "../agent";
import type { ConversationState } from "../state-machine";
import { ALLOWED_TRANSITIONS } from "../state-machine";
import { createInterface } from "readline";

// ── State tracking ──
interface SimState {
  conversationState: ConversationState;
  clientName: string | null;
  theme: string | null;
  outfitDescription: string | null;
  extraRequests: string | null;
  photosCount: number;
  hasConsent: boolean;
}

const state: SimState = {
  conversationState: "GREETING",
  clientName: null,
  theme: null,
  outfitDescription: null,
  extraRequests: null,
  photosCount: 0,
  hasConsent: false,
};

const history: { role: "user" | "assistant"; content: string }[] = [];

// ── Scripted scenarios ──
interface ScenarioStep {
  user: string;
  expect?: {
    tool?: string;
    nextState?: ConversationState;
  };
}

const SCENARIOS: Record<string, ScenarioStep[]> = {
  happy: [
    { user: "Oi!", expect: { nextState: "GREETING" } },
    { user: "Disney", expect: { nextState: "COLLECTING_THEME" } },
    { user: "Vestido de princesa rosa", expect: { nextState: "COLLECTING_OUTFIT" } },
    { user: "Um cachorrinho", expect: { nextState: "COLLECTING_OUTFIT" } },
    { user: "[Foto enviada]\n[Fotos recebidas: 1 foto(s)]\n[URLs das fotos: https://example.com/photo.jpg]", expect: { nextState: "COLLECTING_PHOTOS" } },
    { user: "Confirmar", expect: { nextState: "CONFIRMING_ORDER" } },
  ],
  revision: [
    { user: "Oi!", expect: { nextState: "GREETING" } },
    { user: "Herói", expect: { nextState: "COLLECTING_THEME" } },
    { user: "Roupa de super-herói", expect: { nextState: "COLLECTING_OUTFIT" } },
    { user: "Não", expect: { nextState: "COLLECTING_OUTFIT" } },
  ],
  abandoned: [
    { user: "Oi!", expect: { nextState: "GREETING" } },
    { user: "Disney", expect: { nextState: "COLLECTING_THEME" } },
  ],
};

// ── Console formatting ──
const COLORS = {
  reset: "\x1b[0m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  magenta: "\x1b[35m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
};

function log(prefix: string, color: string, text: string) {
  console.log(`${color}${prefix}${COLORS.reset} ${text}`);
}

async function processStep(userMessage: string): Promise<string> {
  log(">", COLORS.cyan, userMessage);

  history.push({ role: "user", content: userMessage });

  const response = await processMessage(
    {
      id: mockOrder.id,
      clientId: mockOrder.clientId,
      conversationState: state.conversationState,
      clientName: state.clientName,
      theme: state.theme,
      outfitDescription: state.outfitDescription,
      extraRequests: state.extraRequests,
      photosCount: state.photosCount,
      preFillText: state.conversationState === "GREETING" ? userMessage : null,
      hasConsent: state.hasConsent,
    },
    userMessage,
    history.slice(0, -1), // exclude the message we just pushed
  );

  history.push({ role: "assistant", content: response });

  log("Mia:", COLORS.green, response);
  log("State:", COLORS.dim, state.conversationState);
  console.log();

  return response;
}

// ── Main ──
async function runScenario(name: string) {
  const steps = SCENARIOS[name];
  if (!steps) {
    console.error(`Unknown scenario: ${name}. Available: ${Object.keys(SCENARIOS).join(", ")}`);
    process.exit(1);
  }

  console.log(`\n${COLORS.bold}Running scenario: ${name}${COLORS.reset}\n`);

  for (const step of steps) {
    await processStep(step.user);
  }

  console.log(`\n${COLORS.bold}Scenario "${name}" complete.${COLORS.reset}`);
}

async function runInteractive() {
  console.log(`\n${COLORS.bold}Músicas Personalizadas Conversation Simulator${COLORS.reset}`);
  console.log(`${COLORS.dim}Type messages as the client. Type /quit to exit, /state to see current state, /reset to restart.${COLORS.reset}\n`);

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const prompt = () => {
    rl.question(`${COLORS.cyan}You> ${COLORS.reset}`, async (input) => {
      const trimmed = input.trim();

      if (!trimmed) {
        prompt();
        return;
      }

      if (trimmed === "/quit" || trimmed === "/exit") {
        rl.close();
        return;
      }

      if (trimmed === "/state") {
        console.log(JSON.stringify(state, null, 2));
        prompt();
        return;
      }

      if (trimmed === "/reset") {
        state.conversationState = "GREETING";
        state.clientName = null;
        state.theme = null;
        state.outfitDescription = null;
        state.extraRequests = null;
        state.photosCount = 0;
        state.hasConsent = false;
        history.length = 0;
        console.log(`${COLORS.yellow}State reset to GREETING${COLORS.reset}\n`);
        prompt();
        return;
      }

      if (trimmed.startsWith("/set ")) {
        const [key, ...valueParts] = trimmed.slice(5).split("=");
        const value = valueParts.join("=");
        if (key && value !== undefined) {
          const k = key.trim() as keyof SimState;
          if (k in state) {
            (state as Record<string, unknown>)[k] = value === "null" ? null : value;
            console.log(`${COLORS.yellow}Set ${k} = ${value}${COLORS.reset}\n`);
          }
        }
        prompt();
        return;
      }

      try {
        await processStep(trimmed);
      } catch (err) {
        console.error(`${COLORS.magenta}Error:${COLORS.reset}`, err);
      }

      prompt();
    });
  };

  prompt();
}

// ── Entry point ──
const args = process.argv.slice(2);
const scenarioIdx = args.indexOf("--scenario");

if (scenarioIdx !== -1 && args[scenarioIdx + 1]) {
  await runScenario(args[scenarioIdx + 1]);
} else {
  await runInteractive();
}
