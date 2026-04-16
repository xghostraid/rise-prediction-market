#!/usr/bin/env bash
# Create multiple dummy ETH markets on an existing MarketFactory (for UI testing).
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
  echo ""
  echo "  export PRIVATE_KEY='0x<64 hex characters>'"
  echo "  bash scripts/create-dummy-markets.sh"
  echo ""
  echo "Required after deploy:"
  echo "  export MARKET_FACTORY=0x…     # from Deploy logs: \"MarketFactory:\" (not your wallet)"
  echo "  export ORACLE=0x…             # default: address from your PRIVATE_KEY"
  echo "  export DUMMY_MARKET_COUNT=8   # default 5, max 25"
  echo ""
  echo "Fund testnet ETH: https://faucet.testnet.riselabs.xyz"
  exit 1
fi

PRIVATE_KEY="$(printf '%s' "${PRIVATE_KEY}" | tr -d '[:space:]')"
if [[ "${PRIVATE_KEY}" != 0x* ]]; then
  PRIVATE_KEY="0x${PRIVATE_KEY}"
fi
export PRIVATE_KEY

HEX="${PRIVATE_KEY#0x}"
if [[ ${#HEX} -ne 64 ]] || ! [[ "${HEX}" =~ ^[0-9a-fA-F]{64}$ ]]; then
  echo "error: PRIVATE_KEY must be 64 hex chars after 0x."
  exit 1
fi

if [[ -z "${MARKET_FACTORY:-}" ]]; then
  echo "error: MARKET_FACTORY is not set."
  echo ""
  echo "Use the contract address printed as \"MarketFactory: 0x…\" when you ran Deploy — not your wallet address."
  echo "  export MARKET_FACTORY=0x…"
  echo "  bash scripts/create-dummy-markets.sh"
  exit 1
fi
export MARKET_FACTORY

if [[ -z "${ORACLE:-}" ]] && command -v cast >/dev/null 2>&1; then
  ORACLE="$(cast wallet address --private-key "${PRIVATE_KEY}" 2>/dev/null || true)"
  export ORACLE
fi

if [[ -z "${ORACLE:-}" ]]; then
  echo "error: set ORACLE or install cast to derive it from PRIVATE_KEY"
  exit 1
fi

RPC="${RISE_RPC_URL:-https://testnet.riselabs.xyz}"
COUNT="${DUMMY_MARKET_COUNT:-5}"

echo "== Dummy markets =="
echo "RPC: ${RPC}"
echo "MARKET_FACTORY: ${MARKET_FACTORY}"
echo "ORACLE: ${ORACLE}"
echo "DUMMY_MARKET_COUNT: ${COUNT}"
if command -v cast >/dev/null 2>&1; then
  ADDR="$(cast wallet address --private-key "${PRIVATE_KEY}" 2>/dev/null || true)"
  if [[ -n "${ADDR}" ]]; then
    BAL="$(cast balance "${ADDR}" --rpc-url "${RPC}" 2>/dev/null || echo "?")"
    echo "broadcaster: ${ADDR}  balance: ${BAL} wei"
  fi
fi
echo ""

set +e
DUMMY_MARKET_COUNT="${COUNT}" forge script script/CreateDummyMarkets.s.sol:CreateDummyMarkets \
  --rpc-url "${RPC}" \
  --broadcast \
  -vvv
CODE=$?
set -e

if [[ "${CODE}" -ne 0 ]]; then
  echo ""
  echo "== Failed (exit ${CODE}) =="
  exit "${CODE}"
fi

echo ""
echo "== Done =="
echo "Reload the web app — you should see ${COUNT} new dummy markets in the feed."
