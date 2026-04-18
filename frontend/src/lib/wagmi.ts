import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { hardhat } from "wagmi/chains";
import { injected } from "wagmi/connectors";

export const wagmiConfig = getDefaultConfig({
  appName: "Killswitch",
  projectId: "f768461b1b70ad09c0d95a122880d829", // Valid dummy hex ID
  chains: [hardhat],
  ssr: false,
});
