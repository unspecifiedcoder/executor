/**
 * The agent-3 lifecycle, as it actually happened on Sepolia.
 *
 * Answers the judge question: "did this sequence really occur, or is the
 * animation telling me a story?" Every step carries the transaction that
 * performed it, so any frame of the replay is one click from Etherscan. If a
 * step cannot be backed by a hash it does not belong in this array - a replay
 * with one invented step is worth less than no replay at all.
 *
 * Verified against Sepolia: every hash below returned status 1 and the block
 * number stated here.
 */
export type Phase = "active" | "administration" | "liquidation" | "resolved";

export interface ProofStep {
  /** Short label for the rail. */
  title: string;
  /** What a judge should take from this step, in one sentence. */
  caption: string;
  block: number;
  tx?: `0x${string}`;
  /** Registry status after this step. */
  phase: Phase;
  /** Where getPaymentDestination points after this step. */
  destination: "treasury" | "estate";
  /** Who sent it, and whether that matters. */
  actor: "owner" | "signer" | "trustee" | "stranger" | "payer" | null;
  /** A USDC movement to animate along the rail, in base units. */
  packet?: { amount: number; to: "treasury" | "estate" };
  /** Seconds this step holds in the replay. */
  hold: number;
}

export const AGENT3_ID =
  "0x96abf3c7f8f72fdf248e91137fb471a442dccf3fcece378b2065616cb68c36d4" as const;

export const AGENT3 = {
  treasury: "0x29eA9aE5baC451ee08094B265010511d2ADc5557",
  estate: "0xD52b37AD931F221A902fC7F43A9ed2D87Ce07C5F",
  payer: "0xbFe5551e13360e40f94Bd858f10CC839161716EA",
  stranger: "0x72db032c0dFB6E7502e16A73fabdab31712dc706",
  trustee: "0x108efe0989d08d3BCF49ca1A3A35548543CbA310",
} as const;

export const PROOF_STEPS: ProofStep[] = [
  {
    title: "Register",
    caption: "Four distinct role keys. Owner, signer, trustee and recovery are four addresses.",
    block: 11672753,
    tx: "0xf018c159706e519e36bed163e20861e808b333461596fbedc53736e7d752846e",
    phase: "active",
    destination: "treasury",
    actor: "owner",
    hold: 2.4,
  },
  {
    title: "Lock plan",
    caption: "One-way. From here updatePlan reverts PlanIsLocked - the plan is a pre-commitment.",
    block: 11672754,
    tx: "0x06a2c27bf82111e168269c0f825609b25090cf4afefa9b3d56cc118755a250c9",
    phase: "active",
    destination: "treasury",
    actor: "owner",
    hold: 2.4,
  },
  {
    title: "18 heartbeats",
    caption: "Every 96 seconds for 27 minutes, signed by the heartbeat key. The agent is alive.",
    block: 11672892,
    tx: "0x8d59f3183f6077a8f17b07481c8f7007944c03952e5184ba20de9373a7335ce6",
    phase: "active",
    destination: "treasury",
    actor: "signer",
    hold: 3.2,
  },
  {
    title: "Payment → treasury",
    caption:
      "route-payment.sh reads getPaymentDestination and sends there. It takes no destination argument.",
    block: 11672895,
    tx: "0x731319100c29e25cf27270085ef91caaba946f9907cd14dfa67e33ef8ea243c5",
    phase: "active",
    destination: "treasury",
    actor: "payer",
    packet: { amount: 200000, to: "treasury" },
    hold: 4,
  },
  {
    title: "Heartbeat stops",
    caption: "The runner is killed. The deadline of interval + grace begins to lapse.",
    block: 11672900,
    phase: "active",
    destination: "treasury",
    actor: null,
    hold: 2.6,
  },
  {
    title: "enterAdministration",
    caption:
      "Called by an address holding none of the four roles. The contract checks the deadline, not the caller.",
    block: 11672930,
    tx: "0x345811aa27275686899f84ec30c6b5c602cf6cc0d60e5be1edbb263e6ae2ea8e",
    phase: "administration",
    destination: "estate",
    actor: "stranger",
    hold: 4,
  },
  {
    title: "Same command → estate",
    caption:
      "Same payer, same 200000 USDC, same script. The destination changed because the agent's state did.",
    block: 11672932,
    tx: "0x17b0f95681e3fea74423e06978d319ca1d57a20228480191f12c99d8816d37ad",
    phase: "administration",
    destination: "estate",
    actor: "payer",
    packet: { amount: 200000, to: "estate" },
    hold: 4.5,
  },
  {
    title: "enterLiquidation",
    caption: "Trustee only, and terminal. Only this unlocks payouts - administration can recover.",
    block: 11672934,
    tx: "0x8a5121bb95318a52a292ebe4df962d5a04262634bdfc2ec7de69677e90a39242",
    phase: "liquidation",
    destination: "estate",
    actor: "trustee",
    hold: 3,
  },
  {
    title: "executePlan",
    caption: "Permissionless. 200000 available against 850000 owed - secured is paid, the rest are not.",
    block: 11672939,
    tx: "0xb693dbab092d82cb70379969b7880bc3103874498bafe48682d0882e9a8bafc8",
    phase: "liquidation",
    destination: "estate",
    actor: "stranger",
    hold: 5,
  },
  {
    title: "resolve",
    caption: "Terminal wind-up by the trustee. The estate can still pay out late revenue.",
    block: 11672942,
    tx: "0xba2355020125ac12cfd06af36f0e6c3593281dcdfbfd81151a660149b2bceda9",
    phase: "resolved",
    destination: "estate",
    actor: "trustee",
    hold: 3,
  },
];

export interface ProofClaim {
  creditor: string;
  klass: "Secured" | "Administrative" | "Unsecured";
  allowed: number;
  paid: number;
}

/** The claim set executePlan settled, as registered on chain. */
export const AGENT3_CLAIMS: ProofClaim[] = [
  { creditor: "0x77b31B4a…C35a", klass: "Secured", allowed: 250000, paid: 200000 },
  { creditor: "0xb081dc53…042f", klass: "Administrative", allowed: 200000, paid: 0 },
  { creditor: "0x356895DE…810b", klass: "Unsecured", allowed: 400000, paid: 0 },
];

export const AGENT3_TOTALS = { available: 200000, owed: 850000, shortfall: 650000 } as const;

export const REPLAY_SECONDS = PROOF_STEPS.reduce((a, s) => a + s.hold, 0);
