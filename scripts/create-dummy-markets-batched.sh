#!/usr/bin/env bash
# Create many dummy markets in small batches to avoid RPC rate limits (Cloudflare 429 on heavy sims).
# Usage:
#   export PRIVATE_KEY='0x…'
#   export MARKET_FACTORY='0x…'
#   optional: TOTAL=150 BATCH=15 SLEEP_SEC=45 RISE_RPC_URL=https://11155931.rpc.thirdweb.com
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export PATH="${HOME}/.foundry/bin:${PATH}"

if [[ -z "${PRIVATE_KEY:-}" ]] || [[ -z "${MARKET_FACTORY:-}" ]]; then
  echo "error: set PRIVATE_KEY and MARKET_FACTORY (see scripts/create-dummy-markets.sh)"
  exit 1
fi

TOTAL="${TOTAL:-150}"
BATCH="${BATCH:-15}"
SLEEP_SEC="${SLEEP_SEC:-45}"
RPC="${RISE_RPC_URL:-https://testnet.riselabs.xyz}"

# Thirdweb RPC often tolerates bursts better; override if primary keeps 429'ing:
#   export RISE_RPC_URL=https://11155931.rpc.thirdweb.com

if [[ -z "${ORACLE:-}" ]] && command -v cast >/dev/null 2>&1; then
  ORACLE="$(cast wallet address --private-key "${PRIVATE_KEY}" 2>/dev/null || true)"
  export ORACLE
fi

runs=$(( (TOTAL + BATCH - 1) / BATCH ))
echo "== Batched dummy markets: total=${TOTAL} batch=${BATCH} runs=${runs} sleep=${SLEEP_SEC}s RPC=${RPC} =="

for ((n = 1; n <= runs; n++)); do
  left=$((TOTAL - (n - 1) * BATCH))
  if ((left > BATCH)); then
    cnt=$BATCH
  else
    cnt=$left
  fi
  if ((cnt <= 0)); then break; fi
  echo ""
  echo "--- Batch ${n}/${runs}: creating ${cnt} markets ---"
  DUMMY_MARKET_COUNT="${cnt}" RISE_RPC_URL="${RPC}" forge script script/CreateDummyMarkets.s.sol:CreateDummyMarkets \
    --rpc-url "${RPC}" \
    --broadcast \
    -vvv
  if ((n < runs)); then
    echo "Sleeping ${SLEEP_SEC}s to cool down RPC..."
    sleep "${SLEEP_SEC}"
  fi
done

echo ""
echo "== All batches finished. Reload the web app. =="
