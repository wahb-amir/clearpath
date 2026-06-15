import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-display", display: "swap" });

export const metadata: Metadata = {
  title: "ClearPath — Turn Confusion Into Clarity",
  description:
    "ClearPath helps students, parents, and caregivers understand confusing school and community documents instantly. Get plain-language summaries, deadlines, and action plans.",
  keywords: "document clarity, AI assistant, school notices, parent resources, plain language",
  openGraph: {
    title: "ClearPath — Turn Confusion Into Clarity",
    description: "Understand any confusing document in seconds with AI-powered clarity.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${outfit.variable}`} data-scroll-behavior="smooth">
      <body>
        {children}
      </body>
    </html>
  );
}
