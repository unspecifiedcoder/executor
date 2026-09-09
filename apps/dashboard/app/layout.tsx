import type { Metadata } from "next";
import type { ReactNode } from "react";
import AmbientField from "./components/AmbientField";
import FlipBurst from "./components/FlipBurst";
import { Nav, Footer } from "./components/SiteChrome";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Executor",
    template: "%s — Executor",
  },
  description:
    "An x402 endpoint whose payout account is decided by on-chain state, so an agent that stops answering is not paid into an unreachable account.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AmbientField />
        <FlipBurst />
        <Nav />
        {children}
        <Footer />
      </body>
    </html>
  );
}
