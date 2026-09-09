/**
 * The "syncing with Sepolia" shimmer.
 *
 * This used to live at `app/loading.tsx`. A root-level `loading.tsx` makes every
 * route below it a streaming boundary, so Next flushed a `200 OK` before the
 * page body ran - which meant `notFound()` on `/agent/<unregistered>` rendered
 * the 404 page with an HTTP 200 status. Reproduced in a production build, not
 * just dev. It is now a plain component used inside a scoped `<Suspense>`, so
 * the status code is settled before anything streams.
 */
export default function SyncingBar({ label = "SYNCING WITH SEPOLIA" }: { label?: string }) {
  return (
    <div className="syncing">
      <div className="syncing-readout mono">{label}</div>
      <div className="syncing-bar">
        <div className="syncing-bar-fill" />
      </div>

      <style>{`
        .syncing {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 16px;
          padding: 48px 0;
        }
        .syncing-readout {
          font-size: 12px;
          letter-spacing: 0.14em;
          color: var(--faint);
        }
        .syncing-bar {
          width: 160px;
          height: 2px;
          background: var(--border);
          overflow: hidden;
          border-radius: 1px;
        }
        .syncing-bar-fill {
          width: 40%;
          height: 100%;
          background: var(--succession);
          animation: syncing-scan 1.1s linear infinite;
        }
        @keyframes syncing-scan {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
      `}</style>
    </div>
  );
}
