#!/usr/bin/env bash
# Create dummy OrderBookMarket instances for UI testing.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export PATH="${HOME}/.foundry/bin:${PATH}"

if ! command -v forge >/dev/null 2>&1; then
  echo "error: forge not found. Install Foundry: https://book.getfoundry.sh/getting-started/installation"
  exit 1
fi

if [[ -z "${PRIVATE_KEY:-}" ]]; then
  echo "error: PRIVATE_KEY is not set."
  exit 1
fi

if [[ -z "${ORDERBOOK_FACTORY:-}" ]]; then
  echo "error: ORDERBOOK_FACTORY is not set (OrderBookFactory contract address)."
  exit 1
fi

PRIVATE_KEY="$(printf '%s' "${PRIVATE_KEY}" | tr -d '[:space:]')"
if [[ "${PRIVATE_KEY}" != 0x* ]]; then
  PRIVATE_KEY="0x${PRIVATE_KEY}"
fi
export PRIVATE_KEY

ORDERBOOK_FACTORY="$(printf '%s' "${ORDERBOOK_FACTORY}" | tr -d '[:space:]')"
export ORDERBOOK_FACTORY

RPC="${RISE_RPC_URL:-https://testnet.riselabs.xyz}"

echo "RPC: ${RPC}"
echo "ORDERBOOK_FACTORY: ${ORDERBOOK_FACTORY}"
echo ""

forge script script/CreateDummyOrderBookMarkets.s.sol:CreateDummyOrderBookMarkets \
  --rpc-url "${RPC}" \
  --broadcast \
  -vvv

