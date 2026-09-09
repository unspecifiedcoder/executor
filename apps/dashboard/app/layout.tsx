import type { ReactNode } from "react";
import AmbientField from "./components/AmbientField";
import FlipBurst from "./components/FlipBurst";
import { Nav, Footer } from "./components/SiteChrome";
import "./globals.css";

export const metadata = {
  title: "Executor — Vital Signs",
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
