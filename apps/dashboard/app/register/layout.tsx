import type { Metadata } from "next";
import type { ReactNode } from "react";

// `page.tsx` here is a client component and cannot export `metadata`, so the
// route's title lives in this layout.
export const metadata: Metadata = {
  title: "Register an Agent",
  description: "Register a resolution plan on the same ExecutorRegistry deployment as the demo.",
};

export default function RegisterLayout({ children }: { children: ReactNode }) {
  return children;
}
