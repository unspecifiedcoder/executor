"use client";

import { useEffect, useState } from "react";
import { createWalletClient, custom, type Address, type Hex } from "viem";
import { sepolia } from "viem/chains";
import { EXECUTOR_REGISTRY, EXECUTOR_REGISTRY_ABI, sepoliaPublicClient } from "../../../lib/ens";

const SEPOLIA_CHAIN_ID_HEX = "0xaa36a7";

/** Only renders a working button when the connected wallet is this agent's
 * own heartbeatSigner - checked via eth_accounts (no popup) on mount, so a
 * visitor who isn't the signer sees nothing rather than a button that would
 * just revert with NotHeartbeatSigner. */
export default function HeartbeatButton({ agentId, heartbeatSigner }: { agentId: Hex; heartbeatSigner: Address }) {
  const [account, setAccount] = useState<Address | null>(null);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const eth = (window as { ethereum?: any }).ethereum;
    if (!eth) return;
    eth
      .request({ method: "eth_accounts" })
      .then((accs: string[]) => {
        if (accs[0]) setAccount(accs[0] as Address);
      })
      .catch(() => {});
  }, []);

  if (!account || account.toLowerCase() !== heartbeatSigner.toLowerCase()) return null;

  async function sendHeartbeat() {
    setStatus("sending");
    setErrorMsg(null);
    try {
      const eth = (window as { ethereum?: any }).ethereum;
      const chainId: string = await eth.request({ method: "eth_chainId" });
      if (chainId !== SEPOLIA_CHAIN_ID_HEX) {
        await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: SEPOLIA_CHAIN_ID_HEX }] });
      }
      const wallet = createWalletClient({ chain: sepolia, transport: custom(eth) });
      const hash = await wallet.writeContract({
        account: account!,
        address: EXECUTOR_REGISTRY,
        abi: EXECUTOR_REGISTRY_ABI,
        functionName: "heartbeat",
        args: [agentId],
      });
      setTxHash(hash);
      const receipt = await sepoliaPublicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("heartbeat() transaction reverted");
      setStatus("sent");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "heartbeat() failed");
      setStatus("error");
    }
  }

  return (
    <div className="heartbeat-cta">
      <button className="btn pressable" onClick={sendHeartbeat} disabled={status === "sending"}>
        {status === "sending" ? "[ SUBMITTING… ]" : "[ SEND HEARTBEAT ]"}
      </button>
      {txHash && (
        <a className="mono" href={`https://sepolia.etherscan.io/tx/${txHash}`} target="_blank" rel="noreferrer">
          {txHash.slice(0, 10)}… ↗
        </a>
      )}
      {errorMsg && <span className="error mono">{errorMsg}</span>}

      <style>{`
        .heartbeat-cta {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-top: 16px;
          flex-wrap: wrap;
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
        }
        .heartbeat-cta a {
          font-size: 11px;
          color: var(--succession);
        }
        .error {
          font-size: 11px;
          color: var(--liquidation);
        }
      `}</style>
    </div>
  );
}
