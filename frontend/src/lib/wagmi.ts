import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { hardhat } from "wagmi/chains";
import { injected } from "wagmi/connectors";

export const wagmiConfig = getDefaultConfig({
  appName: "Killswitch",
  // For local Hardhat — no real WalletConnect ID needed
  projectId: "vault-sentinel-local",
  chains: [hardhat],
  connectors: [injected()],
  ssr: false,
});
