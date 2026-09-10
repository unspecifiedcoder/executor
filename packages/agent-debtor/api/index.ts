/**
 * Serverless entrypoint for the x402 gateway.
 *
 * The gateway is an ordinary Express app, and Vercel can serve one directly as
 * a Node function - so this file exists only to import it with the listen()
 * suppressed. Everything that matters (the x402 payment middleware, and the
 * per-request `getPaymentDestination` read that decides payTo) is unchanged
 * and shared with the local server; there is no second copy of the logic to
 * drift.
 *
 * Why hosting matters here rather than being a nice-to-have: an x402 resource
 * server that only answers on localhost cannot be paid by anyone else, so the
 * late-binding payTo behaviour is unverifiable by a third party no matter how
 * real it is.
 */
process.env.X402_GATEWAY_SERVERLESS = "1";

export { default } from "../src/gateway.js";
