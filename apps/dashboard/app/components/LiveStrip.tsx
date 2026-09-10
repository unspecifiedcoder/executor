"use client";

import Link from "next/link";

/**
 * Answers the judge question: "is the thing I'm looking at happening now, or is
 * it a recording?"
 *
 * Two modes, because the overview shows both and they must never be confused.
 * While the replay is scrubbing agent 3, this reports what the *replay* is —
 * historical, terminal, a different agent. It only reports live registry state
 * when the page is at rest.
 *
 * The previous version always showed the live agent, so a frame with agent 3's
 * estate in the hopper carried a footer saying "DESTINATION NOW 0x7ea7…7330" —
 * agent 4's treasury. That is the single fastest way to make a judge distrust
 * every number on the page.
 */
export default function LiveStrip({
  replaying,
  phase,
  live,
}: {
  replaying: boolean;
  phase: string;
  live: {
    name: string;
    status: string;
    destination: string;
    lock: string;
    index: string;
    plan: string;
  };
}) {
  if (replaying) {
    return (
      <section className="live-strip mono proofmode">
        <div>
          <span>Showing</span>
          <b>Proof replay — not live</b>
        </div>
        <div>
          <span>Agent</span>
          <b>0x96abf3c7…8c36d4</b>
        </div>
        <div>
          <span>State at this step</span>
          <b>{phase}</b>
        </div>
        <div>
          <span>Settled</span>
          <b>on Sepolia, already</b>
        </div>
        <div>
          <span>The live agent</span>
          <b>
            <Link href="/vitals">is on /vitals →</Link>
          </b>
        </div>
      </section>
    );
  }

  return (
    <section className="live-strip mono">
      <div>
        <span>Live agent</span>
        <b>
          {live.name} · {live.status}
        </b>
      </div>
      <div>
        <span>Destination now</span>
        <b>{live.destination}</b>
      </div>
      <div>
        <span>Succession lock</span>
        <b>{live.lock}</b>
      </div>
      <div>
        <span>Index</span>
        <b>{live.index}</b>
      </div>
      <div>
        <span>Plan</span>
        <b>{live.plan}</b>
      </div>
    </section>
  );
}
