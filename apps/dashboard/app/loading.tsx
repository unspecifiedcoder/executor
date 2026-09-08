export default function Loading() {
  return (
    <main className="loading-screen">
      <div className="loading-readout mono">SYNCING WITH SEPOLIA</div>
      <div className="loading-bar">
        <div className="loading-bar-fill" />
      </div>

      <style>{`
        .loading-screen {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 16px;
        }
        .loading-readout {
          font-size: 12px;
          letter-spacing: 0.14em;
          color: var(--faint);
        }
        .loading-bar {
          width: 160px;
          height: 2px;
          background: var(--border);
          overflow: hidden;
          border-radius: 1px;
        }
        .loading-bar-fill {
          width: 40%;
          height: 100%;
          background: var(--succession);
          animation: scan 1.1s linear infinite;
        }
        @keyframes scan {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(350%);
          }
        }
      `}</style>
    </main>
  );
}
