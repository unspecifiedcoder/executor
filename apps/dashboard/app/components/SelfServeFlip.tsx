"use client";

import { useState } from "react";
import { createWalletClient, custom, type Address, type Hex } from "viem";
import { sepolia } from "viem/chains";
import { EXECUTOR_REGISTRY, EXECUTOR_REGISTRY_ABI, AGENT_ID, sepoliaPublicClient } from "../../lib/ens";

const SEPOLIA_CHAIN_ID_HEX = "0xaa36a7";

/**
 * Lets a visitor trigger the flip from their own wallet instead of spending the
 * demo's server-held key.
 *
 * This exists because `enterAdministration` is permissionless by design - the
 * contract checks whether the heartbeat window has lapsed, not who is asking.
 * Routing every click through one operator key was a hosting liability (a public
 * page where anyone can drain the demo's gas) and, worse, it hid the property
 * that makes the protocol work: nobody privileged has to be online for a failed
 * agent's revenue to stop reaching it. A stranger doing it is the design, not a
 * workaround.
 *
 * `restoreActive` deliberately has no equivalent - it is gated to the
 * recoveryAuthority, so a visitor's wallet genuinely cannot substitute.
 */
export default function SelfServeFlip({
  agentId = AGENT_ID,
  onConfirmed,
}: {
  agentId?: Hex;
  onConfirmed?: (txHash: string) => void;
}) {
  const [state, setState] = useState<"idle" | "working" | "done" | "error">("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function flipFromMyWallet() {
    setErrorMsg(null);
    setState("working");
    try {
      const eth = (window as { ethereum?: any }).ethereum;
      if (!eth) throw new Error("No injected wallet found (MetaMask, Rabby, Brave Wallet, …)");

      const accounts: string[] = await eth.request({ method: "eth_requestAccounts" });
      const account = accounts[0] as Address;
      if (!account) throw new Error("No account authorised");

      const chainId: string = await eth.request({ method: "eth_chainId" });
      if (chainId !== SEPOLIA_CHAIN_ID_HEX) {
        await eth.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: SEPOLIA_CHAIN_ID_HEX }],
        });
      }

      const wallet = createWalletClient({ chain: sepolia, transport: custom(eth) });
      const hash = await wallet.writeContract({
        account,
        address: EXECUTOR_REGISTRY,
        abi: EXECUTOR_REGISTRY_ABI,
        functionName: "enterAdministration",
        args: [agentId],
      });
      setTxHash(hash);

      const receipt = await sepoliaPublicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("enterAdministration reverted on-chain");

      setState("done");
      onConfirmed?.(hash);
    } catch (err) {
      // viem wraps the revert; surface the useful part rather than the stack.
      const raw = err instanceof Error ? err.message : String(err);
      const friendly = raw.includes("TooEarly")
        ? "The heartbeat window hasn't lapsed yet - this agent is not eligible for administration."
        : raw.includes("WrongStatus")
          ? "Someone else already moved this agent - it is no longer Active."
          : raw;
      setErrorMsg(friendly);
      setState("error");
    }
  }

  return (
    <div className="self-serve">
      <button className="btn pressable" onClick={flipFromMyWallet} disabled={state === "working"}>
        {state === "working" ? "[ CONFIRM IN WALLET… ]" : "[ TRIGGER IT FROM MY OWN WALLET ]"}
      </button>

      <p className="self-serve-note mono">
        enterAdministration() is permissionless — the contract checks the heartbeat deadline, not
        the caller. You pay your own (worthless) Sepolia gas, and no operator key is involved.
      </p>

      {txHash && (
        <a
          className="self-serve-tx mono"
          href={`https://sepolia.etherscan.io/tx/${txHash}`}
          target="_blank"
          rel="noreferrer"
        >
          {state === "done" ? "confirmed" : "submitted"} {txHash.slice(0, 10)}… ↗
        </a>
      )}
      {errorMsg && <p className="self-serve-error mono">{errorMsg}</p>}

      <style>{`
        .self-serve {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          margin-top: 16px;
        }
        .btn {
          background: transparent;
          border: 1px solid var(--border-strong);
          color: var(--text);
          font-family: var(--mono);
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.05em;
          padding: 10px 16px;
          border-radius: 4px;
        }
        .btn:hover {
          border-color: var(--active);
          color: var(--active);
        }
        .btn:disabled {
          opacity: 0.5;
          cursor: default;
        }
        .self-serve-note {
          max-width: 380px;
          text-align: center;
          font-size: 10px;
          line-height: 1.6;
          color: var(--faint);
          margin: 0;
        }
        .self-serve-tx {
          font-size: 11px;
          color: var(--succession);
        }
        .self-serve-error {
          max-width: 380px;
          text-align: center;
          font-size: 11px;
          color: var(--liquidation);
          margin: 0;
        }
      `}</style>
    </div>
  );
}
