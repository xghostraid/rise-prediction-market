import { riseTestnet } from "@/lib/chains";

const base = riseTestnet.blockExplorers.default.url.replace(/\/$/, "");

export function riseExplorerTxUrl(txHash: string): string {
  return `${base}/tx/${txHash}`;
}

export function riseExplorerBlockUrl(blockNumber: bigint | string | number): string {
  return `${base}/block/${typeof blockNumber === "bigint" ? blockNumber.toString() : String(blockNumber)}`;
}

export function riseExplorerAddressUrl(address: string): string {
  return `${base}/address/${address}`;
}
