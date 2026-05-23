-- AlterTable: Generation — add AI cost tracking columns
ALTER TABLE "Generation" ADD COLUMN "inputTokens" INTEGER;
ALTER TABLE "Generation" ADD COLUMN "outputTokens" INTEGER;
ALTER TABLE "Generation" ADD COLUMN "imageGenerationCostUsd" DECIMAL(10,6);

-- AlterTable: Payment — add Asaas net revenue column
ALTER TABLE "Payment" ADD COLUMN "netAmount" DECIMAL(10,2);
