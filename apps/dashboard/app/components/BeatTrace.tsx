"use client";

/**
 * Answers the judge question: "was it actually alive, and can I see it die?"
 *
 * Three states, drawn from the step rather than looped. A monitor that keeps
 * beating next to the word LIQUIDATION is the single fastest way to lose a
 * judge's trust in every other number on the page — so this one flatlines.
 *
 * Deliberately static SVG per state rather than an animated dash offset: the
 * page has to record cleanly at 25fps, and a continuously animating stroke
 * shimmers at that frame rate.
 */
export default function BeatTrace({ state }: { state: "alive" | "dying" | "dead" }) {
  const qrs = (x: number) => `L${x},44 L${x + 3},16 L${x + 6},58 L${x + 9},44 `;
  let d = "M0,44 ";
  let x = 16;
  if (state === "alive") {
    while (x < 330) {
      d += qrs(x);
      x += 34;
    }
  } else if (state === "dying") {
    // widening gaps: the agent is missing beats before it misses the deadline
    const gaps = [34, 38, 54, 76];
    let k = 0;
    while (x < 250) {
      d += qrs(x);
      x += gaps[Math.min(k++, gaps.length - 1)];
    }
  }
  d += "L340,44";

  return (
    <div className="trace">
      {state === "dead" && <span className="nosig mono">no signal</span>}
      <svg viewBox="0 0 340 74" preserveAspectRatio="none" aria-hidden="true">
        <path
          d={d}
          fill="none"
          strokeWidth="1.7"
          strokeLinejoin="round"
          stroke={state === "dead" ? "var(--terminal)" : "var(--alive)"}
        />
      </svg>
    </div>
  );
}
