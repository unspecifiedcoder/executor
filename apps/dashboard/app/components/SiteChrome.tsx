"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getAgentStatus, EXECUTOR_REGISTRY, AGENT_ID } from "../../lib/ens";

export function Nav() {
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    getAgentStatus()
      .then(setStatus)
      .catch(() => {});
  }, []);

  return (
    <nav className="site-nav">
      <div className="site-nav-inner">
        <Link href="/" className="nav-mark pressable">
          EXECUTOR
        </Link>
        <div className="nav-links">
          <Link href="/" className="nav-link">
            Overview
          </Link>
          <Link href="/vitals" className="nav-link">
            Live agent
          </Link>
          <Link href={`/agent/${AGENT_ID}`} className="nav-link">
            Agent proof
          </Link>
          <Link href="/register" className="nav-link">
            Register
          </Link>
        </div>
        <div className={`nav-status ${status ?? ""}`}>
          <span className="nav-status-dot" />
          <span className="nav-status-label mono">{status ?? "…"}</span>
        </div>
      </div>

      <style>{`
        .site-nav {
          position: sticky;
          top: 0;
          z-index: 10;
          background: color-mix(in srgb, var(--bg) 88%, transparent);
          backdrop-filter: blur(8px);
          border-bottom: 1px solid var(--border);
        }
        .site-nav-inner {
          max-width: 960px;
          margin: 0 auto;
          padding: 14px 24px;
          display: flex;
          align-items: center;
          gap: 24px;
        }
        .nav-mark {
          font-family: var(--mono);
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.24em;
          color: var(--text);
        }
        .nav-links {
          display: flex;
          gap: 18px;
          flex: 1;
        }
        .nav-link {
          font-family: var(--mono);
          font-size: 12px;
          color: var(--faint);
          letter-spacing: 0.02em;
        }
        .nav-link:hover {
          color: var(--succession);
        }
        .nav-status {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .nav-status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--faint);
        }
        .nav-status.active .nav-status-dot {
          background: var(--active);
          box-shadow: 0 0 6px var(--active);
        }
        .nav-status.administration .nav-status-dot {
          background: var(--administration);
          box-shadow: 0 0 6px var(--administration);
        }
        .nav-status.liquidation .nav-status-dot {
          background: var(--liquidation);
        }
        .nav-status-label {
          font-size: 10px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--faint);
        }

        @media (max-width: 640px) {
          .nav-links {
            display: none;
          }
        }
      `}</style>
    </nav>
  );
}

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner mono">
        <a href={`https://sepolia.etherscan.io/address/${EXECUTOR_REGISTRY}`} target="_blank" rel="noreferrer">
          ExecutorRegistry {EXECUTOR_REGISTRY.slice(0, 6)}…{EXECUTOR_REGISTRY.slice(-4)} (Sepolia) ↗
        </a>
        <a
          href="https://sepolia.etherscan.io/address/0x67b728a792e789a8978b30cf1b3b641f19354b43"
          target="_blank"
          rel="noreferrer"
        >
          ENS: executor-hackathon-demo.eth (ENSv2 beta) ↗
        </a>
        <span>Payments: x402 v2 on Hedera testnet</span>
        <a href="https://api.testnet.blocky402.com" target="_blank" rel="noreferrer">
          Facilitator: Blocky402 ↗
        </a>
      </div>

      <style>{`
        .site-footer {
          border-top: 1px solid var(--border);
          margin-top: 40px;
        }
        .site-footer-inner {
          max-width: 960px;
          margin: 0 auto;
          padding: 20px 24px 32px;
          display: flex;
          flex-wrap: wrap;
          gap: 8px 20px;
          font-size: 11px;
          color: var(--faint);
        }
        .site-footer-inner a {
          color: var(--faint);
        }
        .site-footer-inner a:hover {
          color: var(--succession);
        }
      `}</style>
    </footer>
  );
}
