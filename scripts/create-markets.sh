#!/usr/bin/env bash
# Create default ETH (and optional USDC) markets on an existing MarketFactory.
# Run from anywhere; script cds to repo root.
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
  echo "In the SAME terminal session:"
  echo "  export PRIVATE_KEY='0x<64 hex characters>'"
  echo "  bash scripts/create-markets.sh"
  echo ""
  echo "Optional overrides:"
  echo "  export MARKET_FACTORY=0x…   # default: your deployed factory below"
  echo "  export ORACLE=0x…           # default: address derived from PRIVATE_KEY"
  echo "  export USDC_ADDRESS=0x…     # if set, also creates a USDC-collateral market"
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

# Default factory from this project’s deployment (override with MARKET_FACTORY=0x…)
if [[ -z "${MARKET_FACTORY:-}" ]]; then
  echo "error: MARKET_FACTORY is not set."
  echo "  export MARKET_FACTORY=0x…   # from Deploy logs: MarketFactory:"
  exit 1
fi
export MARKET_FACTORY

if [[ -z "${ORACLE:-}" ]] && command -v cast >/dev/null 2>&1; then
  ORACLE="$(cast wallet address --private-key "${PRIVATE_KEY}" 2>/dev/null || true)"
  export ORACLE
fi

if [[ -z "${ORACLE:-}" ]]; then
  echo "error: could not set ORACLE (install cast or export ORACLE=0x…)"
  exit 1
fi

RPC="${RISE_RPC_URL:-https://testnet.riselabs.xyz}"

echo "== Create markets =="
echo "forge $(forge --version | head -1)"
echo "RPC: ${RPC}"
echo "MARKET_FACTORY: ${MARKET_FACTORY}"
echo "ORACLE: ${ORACLE}"
if command -v cast >/dev/null 2>&1; then
  ADDR="$(cast wallet address --private-key "${PRIVATE_KEY}" 2>/dev/null || true)"
  if [[ -n "${ADDR}" ]]; then
    BAL="$(cast balance "${ADDR}" --rpc-url "${RPC}" 2>/dev/null || echo "?")"
    echo "broadcaster: ${ADDR}"
    echo "balance (wei): ${BAL}"
    if [[ "${BAL}" == "0" ]]; then
      echo ""
      echo "warning: balance is 0 — transaction will fail until you fund this address."
    fi
  fi
fi
echo ""

echo "== Broadcasting =="
set +e
forge script script/CreateMarkets.s.sol:CreateMarkets \
  --rpc-url "${RPC}" \
  --broadcast \
  -vvv
CODE=$?
set -e

if [[ "${CODE}" -ne 0 ]]; then
  echo ""
  echo "== CreateMarkets failed (exit ${CODE}) =="
  exit "${CODE}"
fi

echo ""
echo "== Done =="
echo "Refresh http://127.0.0.1:3010 — you should see the new market(s)."
