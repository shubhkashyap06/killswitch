import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { hardhat } from "wagmi/chains";

export const wagmiConfig = getDefaultConfig({
  appName: "Killswitch-Node Security",
  projectId: "killswitch-local",
  chains: [hardhat], // STRICTLY force local hardhat to prevent network mismatches
  ssr: true,
});
