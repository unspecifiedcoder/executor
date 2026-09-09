"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getAgentStatus, EXECUTOR_REGISTRY, AGENT_ID } from "../../lib/ens";

export function Nav() {
  const [status, setStatus] = useState<string | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    getAgentStatus()
      .then(setStatus)
      .catch(() => {});
  }, []);

  return (
    <nav className="site-nav">
      <div className="site-nav-inner">
        <Link href="/" className="nav-mark pressable">
          <span className="nav-mark-box">E</span>
          EXECUTOR
        </Link>
        <div className="nav-links">
          <Link href="/" className={`nav-link ${pathname === "/" ? "active" : ""}`}>
            Overview
          </Link>
          <Link href="/vitals" className={`nav-link ${pathname === "/vitals" ? "active" : ""}`}>
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
          display: flex;
          align-items: center;
          gap: 10px;
          font-family: var(--mono);
          font-size: 13px;
          font-weight: 800;
          letter-spacing: 0.18em;
          color: var(--text);
        }
        .nav-mark-box {
          width: 22px;
          height: 22px;
          display: grid;
          place-items: center;
          border: 1px solid var(--border-strong);
          background: color-mix(in srgb, var(--active) 8%, transparent);
          color: var(--active);
          font-size: 10px;
        }
        .nav-links {
          display: flex;
          gap: 4px;
          flex: 1;
        }
        .nav-link {
          font-family: var(--mono);
          font-size: 12px;
          color: var(--faint);
          letter-spacing: 0.02em;
          padding: 7px 11px;
          border-radius: 4px;
        }
        .nav-link:hover {
          color: var(--text);
          background: color-mix(in srgb, var(--text) 5%, transparent);
        }
        .nav-link.active {
          color: var(--text);
          background: color-mix(in srgb, var(--text) 6%, transparent);
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

        /* The nav used to be display:none below 640px, which left a phone with no
           route to /vitals, /register or the agent page. Instead the bar wraps to a
           second line and the links stay reachable. */
        @media (max-width: 640px) {
          .site-nav-inner {
            flex-wrap: wrap;
            gap: 10px 14px;
            padding: 12px 16px;
          }
          .nav-links {
            order: 3;
            flex-basis: 100%;
            flex-wrap: wrap;
            gap: 2px;
            margin: 0 -6px;
          }
          .nav-link {
            padding: 7px 6px;
          }
          .nav-status {
            margin-left: auto;
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
