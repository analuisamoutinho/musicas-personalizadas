# Story 5.3: Order Completion with Closing CTA

Status: done
GitHub Issue: [mgiovani/fotos#65](https://github.com/mgiovani/fotos/issues/65)

## Story

As a client who approved her mascotinho,
I want a warm closing message with a suggestion to share on Instagram,
So that I feel cared for and the business gets organic social proof.

## Acceptance Criteria

**Given** the client approves the mascotinho (after initial delivery or after revisions)
**When** the Order transitions to COMPLETED (via `handleApproval` tool in AWAITING_FEEDBACK state)
**Then** the bot sends a warm closing message: "Que bom que voce amou! Vai ficar lindo na festinha!"
**And** the bot includes an Instagram CTA: "Se postar no Instagram, marca a gente @mascotinhos!"
**And** the Order `conversationState` is already COMPLETED (set by `handleApproval` in Story 5.1) — no additional state transition needed in this story
**And** no further bot messages are sent for this order unless the client initiates a new conversation
**And** a new message from the same sender after COMPLETED creates a new Order in GREETING state (already handled by Story 2.2's `loadActiveOrder` which filters out COMPLETED orders)

**FRs covered:** FR-30 (completion after revisions), FR-28 (implicit: satisfaction flow)

---

## Status Assessment — What Already Exists

**CRITICAL: Before writing any code, understand these pre-existing implementations:**

### Already implemented (DO NOT replace, DO NOT reinvent):

- `packages/bot-engine/src/tools/handle-approval.ts` — **fully implemented** (Story 5.1). Transitions `AWAITING_FEEDBACK → COMPLETED` and updates `orderStatus` to `DELIVERED`. Returns `{ success: true, message: "Pedido concluído com sucesso!" }`. **No changes to this file**.
- `packages/bot-engine/src/tools/index.ts` — `handleApproval` is already imported, exported, and in `allTools`. **No changes needed**.
- `packages/bot-engine/src/agent.ts` — uses `allTools`. **No changes needed**.
- `packages/bot-engine/src/state-machine.ts` — `AWAITING_FEEDBACK → COMPLETED` already in `ALLOWED_TRANSITIONS`. `COMPLETED: []` (no transitions out). **No schema or state-machine changes needed**.
- `packages/bot-engine/src/conversation.ts` — `loadActiveOrder(senderId)` already excludes COMPLETED orders (filters `status NOT IN COMPLETED, FAILED, ABANDONED_24H`). A new message after COMPLETED automatically creates a new order. **No changes needed**.
- `packages/bot-engine/src/prompts/system-prompt.ts` — **AWAITING_FEEDBACK block already has a placeholder** for the closing message (Story 5.1 left it as: `"por enquanto envie: 'Que alegria! Fico feliz que tenha amado! 💜🎉'"`). This story REPLACES that placeholder with the real closing message + Instagram CTA.
- `packages/bot-engine/src/bot.ts` — already re-loads `postProcessOrder` after `processMessage` and only sends feedback buttons when state is still `AWAITING_FEEDBACK`. After transitioning to COMPLETED, no buttons are sent. **No changes needed to bot.ts**.
- `packages/db/prisma/schema/schema.prisma` — `ConversationState.COMPLETED` already exists. **No schema changes needed**.

### This story creates/modifies:

- **MODIFY** `packages/bot-engine/src/prompts/system-prompt.ts` — replace the Story 5.1 placeholder closing message in the AWAITING_FEEDBACK instruction block with the real closing message + Instagram CTA

### Not part of this story (do NOT implement):

- Story 5.4 abandoned cart — QStash scheduled nudges are Story 5.4's responsibility.
- Any new tool (`handleCompletion` or similar) — the closing message is sent by the AI agent directly via text after `handleApproval` returns success. No new tool needed.
- Any changes to `apps/web/src/app/api/generate/route.ts`, `packages/image-gen/`, or `packages/payments/`.

---

## Developer Context

### Critical Architecture Decision: No New Tool Needed

The closing CTA is a **text message sent by the AI agent** after `handleApproval` returns `{ success: true }`. The agent already calls `handleApproval` and then sends whatever the system prompt instructs. This story only changes what the system prompt instructs the agent to say.

There is NO `handleCompletion` tool, no new file to create — **only one file changes**.

### The Exact Change Required

In `packages/bot-engine/src/prompts/system-prompt.ts`, find the AWAITING_FEEDBACK instruction block. It currently reads (after Story 5.2 updates):

```typescript
`## Instrucoes para o estado AWAITING_FEEDBACK
Quando o estado for AWAITING_FEEDBACK:
1. Assim que o cliente enviar qualquer mensagem, pergunte: "Gostou? Posso ajustar algo? (2 ajustes inclusos) 💕"
2. Se o cliente expressar aprovacao (toque em "Amei!", ou escreva "amei", "ficou perfeito", "lindo", "adorei", "gostei", "perfeito", "otimo"):
   - Chame IMEDIATAMENTE handleApproval com orderId = ID do pedido atual
   - Apos handleApproval retornar success: true, envie a mensagem de encerramento (Story 5.3 ira lidar com isso, por enquanto envie: "Que alegria! Fico feliz que tenha amado! 💜🎉")
...`
```

**Replace item 2's sub-bullet** with the real closing messages:

```typescript
`## Instrucoes para o estado AWAITING_FEEDBACK
Quando o estado for AWAITING_FEEDBACK:
1. Assim que o cliente enviar qualquer mensagem, pergunte: "Gostou? Posso ajustar algo? (2 ajustes inclusos) 💕"
2. Se o cliente expressar aprovacao (toque em "Amei!", ou escreva "amei", "ficou perfeito", "lindo", "adorei", "gostei", "perfeito", "otimo"):
   - Chame IMEDIATAMENTE handleApproval com orderId = ID do pedido atual
   - Apos handleApproval retornar success: true, envie DUAS mensagens separadas:
     a) "Que bom que voce amou! Vai ficar lindo na festinha! 🎉💜"
     b) "Se postar no Instagram, marca a gente @mascotinhos! 📸✨"
   - Apos enviar as mensagens de encerramento, NAO envie mais nada — o pedido esta concluido
   - Se handleApproval retornar success: false por qualquer motivo, informe ao cliente o erro e peca para tentar novamente
...`
```

### Why Two Separate Messages

Sending as two messages mirrors natural WhatsApp conversation UX — the warm acknowledgment lands first, then the Instagram ask. Both are short, friendly, and not pushy. This is consistent with the bot's warm, emoji-rich personality throughout the flow.

### Exact Text of the Closing Messages

- Message 1: `"Que bom que voce amou! Vai ficar lindo na festinha! 🎉💜"`
- Message 2: `"Se postar no Instagram, marca a gente @mascotinhos! 📸✨"`

These are literal strings — do NOT rephrase or translate. They come directly from the epics file (Story 5.3 AC).

### No Bot.ts Changes Needed

`bot.ts` already handles the post-COMPLETED state correctly:
- After `processMessage` (during which agent calls `handleApproval`), `postProcessOrder` is re-loaded
- `postProcessOrder?.conversationState` will be `COMPLETED` (not `AWAITING_FEEDBACK`)
- The feedback buttons block `if (postProcessOrder?.conversationState === "AWAITING_FEEDBACK")` evaluates to false
- No buttons are sent — correct behavior

The COMPLETED state has no interactive buttons by design: `COMPLETED: []` in `ALLOWED_TRANSITIONS` means no further state transitions are possible. A new message from the client starts a fresh order in GREETING state.

### No Tests Required

This story only changes text strings in the system prompt template function. The system prompt is a pure text-building function with no logic branches being added — all logic branches (handleApproval success/failure, state checks) already exist and are tested in Story 5.1's `handle-approval.test.ts`.

If a test file for `system-prompt.ts` exists, verify the AWAITING_FEEDBACK block snapshot tests pass after the change. If no test exists for `system-prompt.ts`, no new test file is required for this story.

### Regression Risk: None

The only file changed is `system-prompt.ts`. The change replaces a placeholder string with real message text. No logic, no state machine, no tool behavior changes. All 171 bot-engine tests from Story 5.2 continue to pass unchanged.

---

## Files to Create/Modify

| Action | File | What changes |
|--------|------|-------------|
| MODIFY | `packages/bot-engine/src/prompts/system-prompt.ts` | Replace Story 5.1 placeholder closing message in AWAITING_FEEDBACK block with real closing message + Instagram CTA |

**Files that DO NOT need changes:**
- `packages/bot-engine/src/tools/handle-approval.ts` — already fully implemented
- `packages/bot-engine/src/tools/index.ts` — no changes
- `packages/bot-engine/src/bot.ts` — already handles post-COMPLETED state correctly
- `packages/bot-engine/src/state-machine.ts` — no changes
- `packages/bot-engine/src/conversation.ts` — no changes
- Any files in `apps/web/`, `packages/image-gen/`, `packages/db/`, `packages/payments/`

---

## Tasks / Subtasks

- [x] Task 1: Update system prompt AWAITING_FEEDBACK instruction block (AC: all)
  - [x] 1.1: In `packages/bot-engine/src/prompts/system-prompt.ts`, find the `## Instrucoes para o estado AWAITING_FEEDBACK` section
  - [x] 1.2: In item 2 (approval path), replace the sub-bullet that reads `"Apos handleApproval retornar success: true, envie a mensagem de encerramento (Story 5.3 ira lidar com isso, por enquanto envie: 'Que alegria! Fico feliz que tenha amado! 💜🎉')"` with:
    ```
    - Apos handleApproval retornar success: true, envie DUAS mensagens separadas:
        a) "Que bom que voce amou! Vai ficar lindo na festinha! 🎉💜"
        b) "Se postar no Instagram, marca a gente @mascotinhos! 📸✨"
      - Apos enviar as mensagens de encerramento, NAO envie mais nada — o pedido esta concluido
      - Se handleApproval retornar success: false por qualquer motivo, informe ao cliente o erro e peca para tentar novamente
    ```
  - [x] 1.3: Verify the full `buildSystemPrompt()` function still compiles with `bun run check-types` from `mascotinhos/`

---

## Dev Notes

### Architecture Compliance

- **Tool pattern:** No new tool created — this story is purely a system prompt update.
- **DB access:** No DB changes. `handleApproval` (Story 5.1) already transitions state and updates `orderStatus`.
- **State transitions:** No new transitions. `AWAITING_FEEDBACK → COMPLETED` is already implemented and validated.
- **Logging:** No new log entries needed — no new code paths.
- **Webhook handler:** `bot.ts` must never throw — no changes to bot.ts, this invariant is unaffected.

### Conversation Flow After This Story

```
Client taps "Amei! 💜" in AWAITING_FEEDBACK
  → agent recognizes approval intent
  → agent calls handleApproval({ orderId })
  → handleApproval: AWAITING_FEEDBACK → COMPLETED, orderStatus → DELIVERED
  → agent sends: "Que bom que voce amou! Vai ficar lindo na festinha! 🎉💜"
  → agent sends: "Se postar no Instagram, marca a gente @mascotinhos! 📸✨"
  → conversation ends for this order

Next message from same client phone number:
  → loadActiveOrder(senderId) finds no active order (COMPLETED is excluded)
  → createOrder() creates new Order in GREETING state
  → new conversation begins
```

### Cross-Story Dependencies

- **Story 5.1** (done): Implemented `handleApproval` tool and the AWAITING_FEEDBACK instruction block with placeholder closing message. This story replaces that placeholder.
- **Story 5.2** (done): Implemented `handleRevision` tool and REVISION_1/REVISION_2 instruction blocks. The AWAITING_FEEDBACK block was also updated to remove the stale "Not implemented yet" handleRevision fallback.
- **Story 5.4** (backlog): Abandoned cart recovery via QStash — unrelated to this story.

### References

- System prompt file: `mascotinhos/packages/bot-engine/src/prompts/system-prompt.ts`
- Tool already implemented: `mascotinhos/packages/bot-engine/src/tools/handle-approval.ts`
- State machine: `mascotinhos/packages/bot-engine/src/state-machine.ts`
- Epic 5 Story 5.3 AC: `.bmad_output/planning-artifacts/epics.md` (line 713–730)
- Story 5.1 (for context on how AWAITING_FEEDBACK block was written): `.bmad_output/implementation-artifacts/story-5.1.md`
- Story 5.2 (for context on last system-prompt.ts changes): `.bmad_output/implementation-artifacts/story-5.2.md`
- Bot flow after COMPLETED: `mascotinhos/packages/bot-engine/src/bot.ts` (lines 211–245)
- Active order filtering: `mascotinhos/packages/bot-engine/src/conversation.ts` (loadActiveOrder)

---

## Review Findings (2026-03-30)

**Reviewer:** claude-sonnet-4-6 — adversarial + edge case + acceptance audit

### Summary

The change is a single system prompt text replacement: the Story 5.1 placeholder closing message is replaced with the real two-message closing sequence and Instagram CTA. No logic, state machine, tool behavior, or DB schema changes. All acceptance criteria are met by the implementation.

### Findings Applied (1 patch)

**MEDIUM — Missing test coverage for AWAITING_FEEDBACK closing messages in `system-prompt.test.ts`**
- The existing test file had no assertions for the AWAITING_FEEDBACK instruction block. A future prompt refactor could silently drop or corrupt the closing messages without any test failing.
- **Fix applied:** Added 5 test cases to `system-prompt.test.ts` covering: warm closing message text, Instagram CTA text, two-message instruction, no-further-messages instruction, and handleApproval error-path instruction. All 177 bot-engine tests pass (5 new tests added).
- File: `mascotinhos/packages/bot-engine/src/prompts/system-prompt.test.ts`

### Findings Deferred (0 items)

No HIGH or MEDIUM findings deferred to deferred-work.md. The single MEDIUM finding was patched in this review.

### Acceptance Criteria Verification

| AC | Status | Notes |
|----|--------|-------|
| Warm closing message "Que bom que voce amou! Vai ficar lindo na festinha!" | PASS | Line 133 of system-prompt.ts |
| Instagram CTA "Se postar no Instagram, marca a gente @mascotinhos!" | PASS | Line 134 of system-prompt.ts |
| Two separate messages | PASS | "DUAS mensagens separadas" instruction |
| No further messages after closing | PASS | "NAO envie mais nada — o pedido esta concluido" |
| conversationState already COMPLETED (set by handleApproval) | PASS | No state transition added in this story — handled by Story 5.1 |
| New message after COMPLETED creates fresh order | PASS | loadActiveOrder excludes COMPLETED — handled by Story 2.2 |

### Regression Risk

None. The only changed production file is `system-prompt.ts` (text content only). All 177 bot-engine tests pass.

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

No issues encountered. Straightforward string replacement in system-prompt.ts.

### Completion Notes List

- Replaced Story 5.1 placeholder closing message in AWAITING_FEEDBACK instruction block with real closing messages + Instagram CTA.
- Item 2 (approval path) now instructs agent to send two separate messages after handleApproval success: warm acknowledgment then Instagram CTA.
- Also moved the handleApproval success: false error handling from a standalone item 4 into item 2's sub-bullets (cleaner structure, same behavior).
- No new files created, no logic changes, no state machine changes.
- Pre-existing type error in collect-photos.ts (Object possibly 'undefined') and bun:test type errors in payments/storage packages are unrelated to this story — confirmed by absence of any system-prompt.ts errors in tsc output.
- All 172 bot-engine tests pass (0 failures).

### File List

- mascotinhos/packages/bot-engine/src/prompts/system-prompt.ts

### Change Log

- 2026-03-30: Replaced Story 5.1 placeholder closing message in AWAITING_FEEDBACK block with real closing message "Que bom que voce amou! Vai ficar lindo na festinha! 🎉💜" + Instagram CTA "Se postar no Instagram, marca a gente @mascotinhos! 📸✨" as two separate messages. No other files changed.
