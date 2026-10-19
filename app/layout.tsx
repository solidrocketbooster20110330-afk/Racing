import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RACING | Arcade Motorsport",
  description: "A mobile-friendly arcade racing game. Accelerate, brake, steer and chase your best lap.",
  applicationName: "Racing",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Racing"
  }
};

export const viewport: Viewport = {
  themeColor: "#08080d",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
