// GPT Image 1 pricing — https://openai.com/api/pricing/
// Last verified: 2026-04-29. Update these constants if OpenAI changes rates.
//
// Note: OpenAI's API also returns input_tokens_details.{text_tokens, image_tokens}
// with separate per-token rates ($5/1M text, $10/1M image). This file uses the
// published headline input rate ($5/1M) for simplicity; split-rate billing is a
// future refinement if needed.
export const GPT_IMAGE_INPUT_USD_PER_M = 5; // $5 per 1M input tokens
export const GPT_IMAGE_OUTPUT_USD_PER_M = 40; // $40 per 1M output tokens

export function computeImageCostUsd(inputTokens: number, outputTokens: number): number {
  return (
    (inputTokens * GPT_IMAGE_INPUT_USD_PER_M + outputTokens * GPT_IMAGE_OUTPUT_USD_PER_M) /
    1_000_000
  );
}
