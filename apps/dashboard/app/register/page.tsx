"use client";

import Link from "next/link";
import { useState } from "react";
import {
  createWalletClient,
  custom,
  keccak256,
  stringToHex,
  zeroAddress,
  type Address,
  type Hex,
} from "viem";
import { sepolia } from "viem/chains";
import { EXECUTOR_REGISTRY, EXECUTOR_REGISTRY_ABI, getAgentPlan, sepoliaPublicClient } from "../../lib/ens";

const SEPOLIA_CHAIN_ID_HEX = "0xaa36a7"; // 11155111

type Step = "connect" | "form" | "registering" | "registered" | "locking" | "locked" | "error";

interface Fields {
  label: string;
  heartbeatSigner: string;
  trustee: string;
  recoveryAuthority: string;
  treasury: string;
  estate: string;
  heartbeatInterval: string;
  gracePeriod: string;
}

function isAddress(v: string): v is Address {
  return /^0x[a-fA-F0-9]{40}$/.test(v);
}

/** Live read of how many of the four authorities are actually distinct. */
function SeparationNote({
  owner,
  signer,
  trustee,
  recovery,
}: {
  owner: string;
  signer: string;
  trustee: string;
  recovery: string;
}) {
  const all = [owner, signer, trustee, recovery].map((a) => a.trim().toLowerCase()).filter(Boolean);
  if (all.length < 4) return null;
  const distinct = new Set(all).size;

  return (
    <div className={`sepnote mono ${distinct === 4 ? "ok" : "warn"}`}>
      <b>{distinct} of 4 authorities distinct</b>
      {distinct === 4 ? (
        <span>
          Owner, signer, trustee and recovery are four different keys. This agent has real
          separation of powers — the owner cannot sign its heartbeats and the trustee cannot
          restore it.
        </span>
      ) : (
        <span>
          Fine for a two-minute test, and prefilled that way on purpose. But one key can then drive
          several transitions at once, so this agent has the state machine without the separation.
          A real plan uses four keys — the demo agent does, and the one that didn&rsquo;t was
          retired for it.
        </span>
      )}
    </div>
  );
}

/**
 * A known-good four-key set, so the *correct* configuration is one click.
 *
 * Before this the easy path (prefill everything with the connected wallet) made
 * the agent the overview draws as a fault, and the correct path meant typing
 * four addresses by hand. That is the incentive backwards: the shape we
 * recommend should be the shape that takes least effort.
 *
 * Treasury and estate are the Hedera-mapped pair the x402 gateway resolves
 * against, so an agent built this way works on the payment rail too and not
 * only on Sepolia.
 */
const DEMO_KEYS = {
  heartbeatSigner: "0xC63adec9161CabA36935138b262267489D2d62D0",
  trustee: "0x108efe0989d08d3BCF49ca1A3A35548543CbA310",
  recoveryAuthority: "0x86A85D90e605B6661808f7Cbe37565dCa49f323E",
  treasury: "0x7ea7f6e97E24F1ad03Db0bd544A0AeF4A1f07330",
  estate: "0xDE3207F493fE4600DeEc424e0875ec943d712337",
} as const;

export default function RegisterPage() {
  const [step, setStep] = useState<Step>("connect");
  const [account, setAccount] = useState<Address | null>(null);
  const [fields, setFields] = useState<Fields>({
    label: "",
    heartbeatSigner: "",
    trustee: "",
    recoveryAuthority: "",
    treasury: "",
    estate: "",
    heartbeatInterval: "3600",
    gracePeriod: "1800",
  });
  const [agentId, setAgentId] = useState<Hex | null>(null);
  const [registerTx, setRegisterTx] = useState<string | null>(null);
  const [lockTx, setLockTx] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [plan, setPlan] = useState<Awaited<ReturnType<typeof getAgentPlan>> | null>(null);

  function set<K extends keyof Fields>(key: K, value: string) {
    setFields((f) => ({ ...f, [key]: value }));
  }

  async function connect() {
    setErrorMsg(null);
    const eth = (window as { ethereum?: any }).ethereum;
    if (!eth) {
      setErrorMsg("No injected wallet found (MetaMask, Rabby, Brave Wallet, etc.)");
      return;
    }
    try {
      const accounts: string[] = await eth.request({ method: "eth_requestAccounts" });
      const chainId: string = await eth.request({ method: "eth_chainId" });
      if (chainId !== SEPOLIA_CHAIN_ID_HEX) {
        try {
          await eth.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: SEPOLIA_CHAIN_ID_HEX }],
          });
        } catch {
          setErrorMsg("Please switch your wallet to Sepolia testnet and try again.");
          return;
        }
      }
      const addr = accounts[0] as Address;
      setAccount(addr);
      setFields((f) => ({
        ...f,
        heartbeatSigner: addr,
        trustee: addr,
        recoveryAuthority: addr,
        treasury: addr,
        estate: addr,
      }));
      setStep("form");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to connect wallet");
    }
  }

  function getWallet() {
    const eth = (window as { ethereum?: any }).ethereum;
    return createWalletClient({ chain: sepolia, transport: custom(eth) });
  }

  async function register() {
    if (!account) return;
    setErrorMsg(null);

    if (!fields.label.trim()) return setErrorMsg("Give your agent a label");
    for (const key of ["heartbeatSigner", "trustee", "recoveryAuthority", "treasury", "estate"] as const) {
      if (!isAddress(fields[key])) return setErrorMsg(`${key} is not a valid address`);
    }

    const id = keccak256(stringToHex(fields.label.trim()));
    setAgentId(id);
    setStep("registering");

    try {
      const wallet = getWallet();
      const existing = await getAgentPlan(id);
      if (existing.owner !== zeroAddress) {
        setErrorMsg(`Label "${fields.label}" is already registered - pick another`);
        setStep("form");
        return;
      }

      const txHash = await wallet.writeContract({
        account,
        address: EXECUTOR_REGISTRY,
        abi: EXECUTOR_REGISTRY_ABI,
        functionName: "registerAgent",
        args: [
          id,
          fields.heartbeatSigner as Address,
          fields.trustee as Address,
          fields.recoveryAuthority as Address,
          fields.treasury as Address,
          fields.estate as Address,
          BigInt(fields.heartbeatInterval),
          BigInt(fields.gracePeriod),
        ],
      });
      setRegisterTx(txHash);
      const receipt = await sepoliaPublicClient.waitForTransactionReceipt({ hash: txHash });
      if (receipt.status !== "success") throw new Error("registerAgent transaction reverted");
      setStep("registered");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "registerAgent failed");
      setStep("form");
    }
  }

  async function lock() {
    if (!account || !agentId) return;
    setErrorMsg(null);
    setStep("locking");
    try {
      const wallet = getWallet();
      const txHash = await wallet.writeContract({
        account,
        address: EXECUTOR_REGISTRY,
        abi: EXECUTOR_REGISTRY_ABI,
        functionName: "lockPlan",
        args: [agentId],
      });
      setLockTx(txHash);
      const receipt = await sepoliaPublicClient.waitForTransactionReceipt({ hash: txHash });
      if (receipt.status !== "success") throw new Error("lockPlan transaction reverted");
      const freshPlan = await getAgentPlan(agentId);
      setPlan(freshPlan);
      setStep("locked");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "lockPlan failed");
      setStep("registered");
    }
  }

  return (
    <main className="register">
      <Link href="/" className="back pressable">
        ← EXECUTOR
      </Link>

      <div className="center">
        <div className="eyebrow">Register your own agent</div>
        <h1>
          One registry. Any agent.
          <br />
          Your keys, your plan.
        </h1>
        <p className="sub">
          This calls <span className="mono">registerAgent()</span> and{" "}
          <span className="mono">lockPlan()</span> directly on the same deployed{" "}
          <a href={`https://sepolia.etherscan.io/address/${EXECUTOR_REGISTRY}`} target="_blank" rel="noreferrer">
            ExecutorRegistry ↗
          </a>{" "}
          our demo agent uses — with your own wallet, your own keys, your own gas. Nothing new to
          deploy.
        </p>

        {/* Naming the limit rather than letting a reader find it. Asking for
            five hex addresses is an admin surface, not a consumer flow, and
            saying so converts a real UX weakness into a scoping statement -
            the same move as the deployment-mismatch table in the README and
            the caveats under the overview. */}
        <div className="scoping mono">
          <b>What this page is</b>
          <span>
            It proves the registry is permissionless: anyone can register an agent on the same
            contract, and we hold no key that could stop them. A production agent would mint the
            heartbeat key for you and default the rest to your wallet. Five addresses are the
            protocol, not the intended consumer flow.
          </span>
        </div>

        {errorMsg && <div className="error-banner mono">{errorMsg}</div>}

        {step === "connect" && (
          <button className="btn pressable" onClick={connect}>
            [ CONNECT WALLET ]
          </button>
        )}

        {(step === "form" || step === "registering") && (
          <div className="form">
            <label>
              Agent label
              <input
                value={fields.label}
                onChange={(e) => set("label", e.target.value)}
                placeholder="my-research-agent.eth"
              />
            </label>
            <div className="fillrow">
              <button
                type="button"
                className="btn fillbtn"
                onClick={() => setFields((f) => ({ ...f, ...DEMO_KEYS }))}
              >
                Use four distinct keys
              </button>
              <span className="fillnote mono">
                fills the five fields below with a working set — or paste your own
              </span>
            </div>

            <label>
              Heartbeat signer
              <input value={fields.heartbeatSigner} onChange={(e) => set("heartbeatSigner", e.target.value)} placeholder="0xC63adec9161CabA36935138b262267489D2d62D0" spellCheck={false} />
            </label>
            <label>
              Trustee
              <input value={fields.trustee} onChange={(e) => set("trustee", e.target.value)} placeholder="0x108efe0989d08d3BCF49ca1A3A35548543CbA310" spellCheck={false} />
            </label>
            <label>
              Recovery authority
              <input value={fields.recoveryAuthority} onChange={(e) => set("recoveryAuthority", e.target.value)} placeholder="0x86A85D90e605B6661808f7Cbe37565dCa49f323E" spellCheck={false} />
            </label>
            <label>
              Treasury (paid while active)
              <input value={fields.treasury} onChange={(e) => set("treasury", e.target.value)} placeholder="0x7ea7f6e97E24F1ad03Db0bd544A0AeF4A1f07330" spellCheck={false} />
            </label>
            <label>
              Estate (paid under administration)
              <input value={fields.estate} onChange={(e) => set("estate", e.target.value)} placeholder="0xDE3207F493fE4600DeEc424e0875ec943d712337" spellCheck={false} />
            </label>

            {/* Connecting a wallet prefills all five fields with that one
                address, because requiring five funded keys before anyone can
                try this would stop most people at the door. But the overview
                renders a same-address role set as a *fault*, and the previous
                demo agent was retired for exactly that configuration - so the
                form has to say what you are about to create rather than let the
                convenience read as an endorsement. */}
            <SeparationNote
              signer={fields.heartbeatSigner}
              trustee={fields.trustee}
              recovery={fields.recoveryAuthority}
              owner={account ?? ""}
            />
            <div className="row2">
              <label>
                Heartbeat interval (s)
                <input value={fields.heartbeatInterval} onChange={(e) => set("heartbeatInterval", e.target.value)} />
              </label>
              <label>
                Grace period (s)
                <input value={fields.gracePeriod} onChange={(e) => set("gracePeriod", e.target.value)} />
              </label>
            </div>
            <button className="btn pressable" onClick={register} disabled={step === "registering"}>
              {step === "registering" ? "[ SUBMITTING… ]" : "[ REGISTER AGENT ]"}
            </button>
          </div>
        )}

        {(step === "registered" || step === "locking") && (
          <div className="form">
            {registerTx && (
              <div className="row">
                <span className="label">registerAgent() tx</span>
                <span className="value">
                  <a href={`https://sepolia.etherscan.io/tx/${registerTx}`} target="_blank" rel="noreferrer">
                    {registerTx.slice(0, 10)}… ↗
                  </a>
                </span>
              </div>
            )}
            <p className="sub">
              Plan is registered but mutable. Locking it freezes treasury/estate/trustee/timing
              forever — the actual pre-commitment. This is optional but is the whole point.
            </p>
            <button className="btn pressable" onClick={lock} disabled={step === "locking"}>
              {step === "locking" ? "[ LOCKING… ]" : "[ LOCK PLAN ]"}
            </button>
          </div>
        )}

        {step === "locked" && plan && agentId && (
          <div className="form">
            {lockTx && (
              <div className="row">
                <span className="label">lockPlan() tx</span>
                <span className="value">
                  <a href={`https://sepolia.etherscan.io/tx/${lockTx}`} target="_blank" rel="noreferrer">
                    {lockTx.slice(0, 10)}… ↗
                  </a>
                </span>
              </div>
            )}
            <div className="row">
              <span className="label">Agent ID</span>
              <span className="value mono">{agentId.slice(0, 14)}…</span>
            </div>
            <div className="row">
              <span className="label">Status</span>
              <span className="value">{plan.status}</span>
            </div>
            <div className="row">
              <span className="label">Locked</span>
              <span className="value">{plan.planLocked ? "yes" : "no"}</span>
            </div>
            <p className="sub">
              Your agent is live on the same contract as our demo. Anyone can read its state with{" "}
              <span className="mono">getPaymentDestination({agentId.slice(0, 10)}…)</span> and build
              a gateway against it, the same way ours works. Our Hedera gateway needs the
              destination address to have a Hedera account; on other rails, whatever maps an
              address to a payout account there.
            </p>
            <Link href={`/agent/${agentId}`} className="btn pressable" style={{ textAlign: "center" }}>
              [ VIEW YOUR AGENT&rsquo;S PUBLIC PROOF PAGE → ]
            </Link>
          </div>
        )}
      </div>

      <style>{`
        .register {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 32px 24px 64px;
        }
        .back {
          align-self: flex-start;
          font-family: var(--mono);
          font-size: 12px;
          letter-spacing: 0.08em;
          color: var(--faint);
        }
        .back:hover {
          color: var(--succession);
        }
        .center {
          width: 100%;
          max-width: 480px;
          margin-top: 40px;
        }
        .eyebrow {
          font-family: var(--mono);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--faint);
          margin-bottom: 16px;
        }
        h1 {
          font-size: 28px;
          font-weight: 600;
          line-height: 1.3;
          margin: 0 0 16px;
          text-wrap: balance;
        }
        .sub {
          font-size: 13px;
          color: var(--dim);
          line-height: 1.6;
          margin: 0 0 24px;
        }
        .sub a {
          color: var(--succession);
        }
        .error-banner {
          font-size: 12px;
          color: var(--liquidation);
          border: 1px solid var(--liquidation);
          border-radius: 4px;
          padding: 8px 12px;
          margin-bottom: 20px;
        }
        .btn {
          background: transparent;
          border: 1px solid var(--border-strong);
          color: var(--text);
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.05em;
          padding: 10px 16px;
          border-radius: 4px;
          font-family: var(--mono);
        }
        .btn:hover {
          border-color: var(--succession);
          color: var(--succession);
        }
        .btn:disabled {
          opacity: 0.5;
          cursor: default;
        }
        .form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .form label {
          display: flex;
          flex-direction: column;
          gap: 6px;
          font-size: 11px;
          color: var(--dim);
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .form input {
          background: var(--raised);
          border: 1px solid var(--border);
          color: var(--text);
          font-family: var(--mono);
          font-size: 13px;
          padding: 10px 12px;
          border-radius: 4px;
          transition: border-color 180ms var(--ease-settle);
        }
        .form input:focus {
          outline: none;
          border-color: var(--succession);
        }
        .row2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .row {
          display: flex;
          justify-content: space-between;
          padding: 10px 0;
          border-bottom: 1px solid var(--border);
          font-size: 13px;
        }
        .row .label {
          color: var(--dim);
        }
        .row .value {
          font-family: var(--mono);
        }
      `}</style>
    </main>
  );
}
