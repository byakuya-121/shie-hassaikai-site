import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "死穢八斎會 | SHIE HASSAIKAI",
    template: "%s | 死穢八斎會",
  },
  description: "死穢八斎會による調査・技術・記録の中枢ポータル。",
};
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}