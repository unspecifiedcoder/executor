import type { ReactNode } from "react";
import AmbientField from "./components/AmbientField";
import "./globals.css";

export const metadata = {
  title: "Executor — Vital Signs",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AmbientField />
        {children}
      </body>
    </html>
  );
}
