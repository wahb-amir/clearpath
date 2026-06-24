import { Inter, Outfit } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});
const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const BASE_URL = "https://clearpath.wahb.space";

export const metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "ClearPath — Turn Confusion Into Clarity",
    template: "%s | ClearPath",
  },
  description:
    "ClearPath uses AI to instantly explain confusing school letters, government forms, and community notices in plain language. Get deadlines, action plans, and trusted links — in seconds.",
  keywords: [
    "document clarity",
    "AI document analysis",
    "school notices explained",
    "plain language documents",
    "immigrant document help",
    "refugee community resources",
    "school letter translator",
    "government form explainer",
    "parent resources",
    "document intelligence",
    "AI assistant for families",
    "bureaucracy simplified",
  ],
  authors: [{ name: "ClearPath", url: BASE_URL }],
  creator: "ClearPath",
  publisher: "ClearPath",
  category: "Education Technology",
  applicationName: "ClearPath",
  referrer: "origin-when-cross-origin",
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: BASE_URL,
  },
  openGraph: {
    title: "ClearPath — Turn Confusion Into Clarity",
    description:
      "ClearPath uses AI to instantly explain confusing school letters, government forms, and community notices in plain language. Get deadlines, action plans, and trusted links — in seconds.",
    url: BASE_URL,
    siteName: "ClearPath",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: `${BASE_URL}/android-chrome-512x512.png`,
        width: 512,
        height: 512,
        alt: "ClearPath — AI Document Intelligence",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ClearPath — Turn Confusion Into Clarity",
    description:
      "Understand any confusing document in seconds with AI-powered plain-language summaries, deadlines, and action plans.",
    images: [`${BASE_URL}/android-chrome-512x512.png`],
    creator: "@clearpath_ai",
  },
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
    other: [
      { rel: "manifest", url: "/site.webmanifest" },
    ],
  },
  verification: {
    // Add your Google Search Console verification token here when available:
    // google: "YOUR_GOOGLE_VERIFICATION_TOKEN",
  },
};

// JSON-LD: WebSite schema (enables Google Sitelinks Search Box)
const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${BASE_URL}/#website`,
  name: "ClearPath",
  alternateName: "ClearPath AI",
  url: BASE_URL,
  description:
    "AI-powered document intelligence platform that helps immigrants, refugees, students, parents, and caregivers understand complex administrative documents instantly.",
  inLanguage: "en-US",
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${BASE_URL}/analyze?q={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
};

// JSON-LD: Organization schema
const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${BASE_URL}/#organization`,
  name: "ClearPath",
  alternateName: "ClearPath AI",
  url: BASE_URL,
  logo: {
    "@type": "ImageObject",
    url: `${BASE_URL}/android-chrome-512x512.png`,
    width: 512,
    height: 512,
  },
  description:
    "ClearPath is an AI-powered document intelligence platform purpose-built to help immigrants, refugees, and underserved communities securely navigate complex administrative systems.",
  foundingDate: "2025",
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer support",
    url: `${BASE_URL}/help-center`,
    availableLanguage: ["English"],
  },
  sameAs: [],
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${outfit.variable}`}
      data-scroll-behavior="smooth"
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
      </head>
      <body style={{ background: "hsl(222, 47%, 5%)" }}>{children}</body>
    </html>
  );
}
