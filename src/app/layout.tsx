import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://shie-hassaikai-site-7o19.vercel.app"),
  title: {
    default: "死穢八斎會 | SHIE HASSAIKAI",
    template: "%s | 死穢八斎會",
  },
  description: "]荒らし界隈のコミュニティ「死穢八斎會」の公式サイトです。死穢八斎會は、荒らし界隈の文化を尊重し、コミュニティの発展と交流を促進することを目的としています。",
  openGraph: {
    title: "死穢八斎會 | SHIE HASSAIKAI",
    description: 荒らし界隈のコミュニティ「死穢八斎會」の公式サイトです。死穢八斎會は、荒らし界隈の文化を尊重し、コミュニティの発展と交流を促進することを目的としています。",
    description: "",
    url: "https://shie-hassaikai-site-7o19.vercel.app/",
    siteName: "死穢八斎會",
    images: [
      {
        url: "/ogp.gif", // public/ogp.gif を指定
        width: 800,
        height: 450,
        alt: "死穢八斎會 | SHIE HASSAIKAI",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "死穢八斎會 | SHIE HASSAIKAI",
    description: "死穢八斎會による調査・技術・記録の中枢ポータル。",
    images: ["/ogp.gif"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
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