#!/usr/bin/env bash
# Deploy MarketFactory to RISE testnet. Run from anywhere; script cds to repo root.
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
  echo "In the SAME terminal session, run (use straight quotes ', not smart quotes ’):"
  echo "  export PRIVATE_KEY='0x<64 hex characters>'"
  echo "  bash scripts/deploy-factory.sh"
  echo ""
  echo "Fund testnet ETH: https://faucet.testnet.riselabs.xyz"
  exit 1
fi

# Trim whitespace / newlines (common when pasting)
PRIVATE_KEY="$(printf '%s' "${PRIVATE_KEY}" | tr -d '[:space:]')"
# Allow missing 0x
if [[ "${PRIVATE_KEY}" != 0x* ]]; then
  PRIVATE_KEY="0x${PRIVATE_KEY}"
fi
export PRIVATE_KEY

HEX="${PRIVATE_KEY#0x}"
if [[ ${#HEX} -ne 64 ]]; then
  echo "error: after 0x prefix, key must be exactly 64 hex characters (got ${#HEX})."
  exit 1
fi
if ! [[ "${HEX}" =~ ^[0-9a-fA-F]{64}$ ]]; then
  echo "error: private key must be hexadecimal only (0-9, a-f)."
  exit 1
fi

RPC="${RISE_RPC_URL:-https://testnet.riselabs.xyz}"

echo "== Tooling =="
echo "forge $(forge --version | head -1)"
echo "RPC: ${RPC}"
if command -v cast >/dev/null 2>&1; then
  CHAIN="$(cast chain-id --rpc-url "${RPC}" 2>/dev/null || echo "?")"
  echo "chain-id from RPC: ${CHAIN} (expect 11155931 for RISE testnet)"
  ADDR="$(cast wallet address --private-key "${PRIVATE_KEY}" 2>/dev/null || true)"
  if [[ -n "${ADDR}" ]]; then
    BAL="$(cast balance "${ADDR}" --rpc-url "${RPC}" 2>/dev/null || echo "?")"
    echo "deployer address: ${ADDR}"
    echo "deployer balance (wei): ${BAL}"
    if [[ "${BAL}" == "0" ]]; then
      echo ""
      echo "warning: balance is 0 — broadcast will fail until you fund this address on RISE testnet."
    fi
  fi
fi
echo ""

echo "== Broadcasting =="
set +e
forge script script/Deploy.s.sol:Deploy \
  --rpc-url "${RPC}" \
  --broadcast \
  -vvv
CODE=$?
set -e

if [[ "${CODE}" -ne 0 ]]; then
  echo ""
  echo "== Deploy failed (exit ${CODE}) =="
  echo "Common causes:"
  echo "  • No testnet ETH on the deployer address (use faucet link above)."
  echo "  • Wrong RPC / offline (try: cast block-number --rpc-url '${RPC}')."
  echo "  • forge not matching this repo (run from: ${ROOT})."
  echo ""
  echo "Paste everything ABOVE (except your key) into a ticket if you need help."
  exit "${CODE}"
fi

echo ""
echo "== Done =="
echo "Copy the MarketFactory address from the logs, then:"
echo "  web/.env.local → NEXT_PUBLIC_MARKET_FACTORY=0x…"
echo "  or  http://127.0.0.1:3010?factory=0x…"
