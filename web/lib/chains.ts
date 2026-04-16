import { defineChain } from "viem";

const rpc =
  process.env.NEXT_PUBLIC_RISE_RPC ?? "https://testnet.riselabs.xyz";

/** RISE Testnet — see https://docs.risechain.com/docs/builders/testnet-details */
export const riseTestnet = defineChain({
  id: 11155931,
  name: "RISE Testnet",
  nativeCurrency: { decimals: 18, name: "Ether", symbol: "ETH" },
  rpcUrls: {
    default: { http: [rpc] },
  },
  blockExplorers: {
    default: {
      name: "RISE Explorer",
      url: "https://explorer.testnet.riselabs.xyz",
    },
  },
});
