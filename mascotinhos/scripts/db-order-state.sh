#!/bin/bash
# Print full DB state for an Order via Supabase PostgREST: status,
# conversation state, photos, payments, generations, client.
# Usage: scripts/db-order-state.sh <orderId>
#
# Note: uses Supabase PostgREST (not Prisma directly) to avoid pulling
# @prisma/adapter-pg into a script that runs outside the workspace tree.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/_lib.sh"

orderId="${1:-}"
if [[ -z "$orderId" ]]; then
  err "Usage: scripts/db-order-state.sh <orderId>"
  exit 2
fi

env_file="$(resolve_env_file)"
SUPABASE_URL="$(get_env "$env_file" SUPABASE_URL)"
SUPABASE_KEY="$(get_env "$env_file" SUPABASE_SERVICE_ROLE_KEY)"

echo "=== db-order-state ==="
echo "Reading env: $env_file"
echo "Order id:    $orderId"
echo

select="id,orderStatus,conversationState,theme,outfitDescription,extraRequests,price,photosUrls,photosDeleteAt,createdAt,updatedAt,Payment(id,asaasId,status,amount,confirmedAt,pixQrStoragePath,pixQrImageUrl,createdAt),Client(id,whatsappSenderId,phone,name,consentTimestamp,deletedAt),Generation(id,attemptNumber,qualityScore,imageUrl,promptUsed,revisionFeedback,createdAt),StyleTemplate(slug,name)"

curl -sS \
  -H "Authorization: Bearer $SUPABASE_KEY" \
  -H "apikey: $SUPABASE_KEY" \
  "$SUPABASE_URL/rest/v1/Order?id=eq.$orderId&select=$select" \
  | python3 -m json.tool
