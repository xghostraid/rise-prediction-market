import { createConfig, http } from "wagmi";
import { injected, walletConnect } from "wagmi/connectors";
import { riseTestnet } from "./chains";

const rpc = process.env.NEXT_PUBLIC_RISE_RPC ?? "https://testnet.riselabs.xyz";

/**
 * WalletConnect / Reown requires every browser origin on the project allowlist
 * (cloud.reown.com). For local dev, omit NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
 * to use injected wallets only (MetaMask, Rabby, etc.) — no allowlist needed.
 */
const rawId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim() ?? "";
const wcProjectId =
  rawId.length > 0 && rawId !== "00000000000000000000000000000000"
    ? rawId
    : undefined;

const connectors = wcProjectId
  ? [injected(), walletConnect({ projectId: wcProjectId })]
  : [injected()];

export const wagmiConfig = createConfig({
  chains: [riseTestnet],
  connectors,
  transports: {
    [riseTestnet.id]: http(rpc),
  },
  ssr: true,
});
