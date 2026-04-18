import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Wallet } from "lucide-react";
import { useAccount } from "wagmi";

/**
 * WalletButton — drops into the existing Topbar slot.
 * Uses the existing border/bg/text classes already on the static button.
 * RainbowKit's ConnectButton.Custom gives us full control over the element
 * so we never render RainbowKit's default styled modal trigger.
 */
export function WalletButton() {
  const { isConnecting, isReconnecting } = useAccount();

  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        mounted,
      }) => {
        const ready = mounted;
        const connected = ready && account && chain;

        return (
          <div
            {...(!ready && {
              "aria-hidden": true,
              style: { opacity: 0, pointerEvents: "none", userSelect: "none" },
            })}
          >
            {!connected ? (
              <button
                onClick={openConnectModal}
                className="flex h-8 items-center gap-2 rounded-md border border-hairline px-2.5 text-[12px] font-medium text-foreground transition-colors hover:bg-secondary"
                aria-label="Connect wallet"
              >
                <Wallet className="h-[14px] w-[14px]" strokeWidth={1.75} />
                <span className="tabular">
                  {isConnecting || isReconnecting ? "Connecting…" : "Connect"}
                </span>
              </button>
            ) : chain.unsupported ? (
              <button
                onClick={openChainModal}
                className="flex h-8 items-center gap-2 rounded-md border border-critical/40 bg-critical/10 px-2.5 text-[12px] font-medium text-critical transition-colors hover:bg-critical/20"
                aria-label="Wrong network"
              >
                <Wallet className="h-[14px] w-[14px]" strokeWidth={1.75} />
                <span className="tabular">Wrong network</span>
              </button>
            ) : (
              <button
                onClick={openAccountModal}
                className="flex h-8 items-center gap-2 rounded-md border border-hairline px-2.5 text-[12px] font-medium text-foreground transition-colors hover:bg-secondary"
                aria-label="Wallet account"
              >
                <Wallet className="h-[14px] w-[14px]" strokeWidth={1.75} />
                <span className="tabular">
                  {account.displayName}
                </span>
              </button>
            )}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
