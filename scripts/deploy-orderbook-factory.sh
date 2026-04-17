#!/usr/bin/env bash
# Deploy OrderBookFactory to RISE testnet. Run from anywhere; script cds to repo root.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export PATH="${HOME}/.foundry/bin:${PATH}"

if ! command -v forge >/dev/null 2>&1; then
  echo "error: forge not found. Install Foundry: https://book.getfoundry.sh/getting-started/installation"
  echo "  Then run: foundryup"
  exit 1
fi

if [[ -z "${PRIVATE_KEY:-}" ]]; then
  echo "error: PRIVATE_KEY is not set."
  echo ""
  echo "In the SAME terminal session, run:"
  echo "  export PRIVATE_KEY='0x<64 hex characters>'"
  echo "  bash scripts/deploy-orderbook-factory.sh"
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
if [[ ${#HEX} -ne 64 ]]; then
  echo "error: after 0x prefix, key must be exactly 64 hex characters (got ${#HEX})."
  exit 1
fi

RPC="${RISE_RPC_URL:-https://testnet.riselabs.xyz}"
echo "RPC: ${RPC}"
echo ""

echo "== Broadcasting =="
forge script script/DeployOrderBookFactory.s.sol:DeployOrderBookFactory \
  --rpc-url "${RPC}" \
  --broadcast \
  -vvv

echo ""
echo "== Done =="
echo "Copy the OrderBookFactory address from the logs."

