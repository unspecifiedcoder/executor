import type { Metadata } from "next";
import type { ReactNode } from "react";

// `page.tsx` here is a client component and cannot export `metadata`, so the
// route's title lives in this layout.
export const metadata: Metadata = {
  title: "Vital Signs",
  description: "Live heartbeat, countdown to administration, and the payment-destination flip.",
};

export default function VitalsLayout({ children }: { children: ReactNode }) {
  return children;
}
