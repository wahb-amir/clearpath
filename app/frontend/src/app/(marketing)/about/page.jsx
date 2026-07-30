import AboutClient from "./AboutClient";

const BASE_URL = "https://clearpath.wahb.space";

export const metadata = {
  title: "About ClearPath — Safety, Trust & Ethics Framework",
  description:
    "Learn how ClearPath responsibly demystifies bureaucracy for immigrants, refugees, and underserved communities using human-in-the-loop AI, adversarial defense, and a 5-stage document intelligence pipeline.",
  alternates: {
    canonical: `${BASE_URL}/about`,
  },
  openGraph: {
    title: "About ClearPath — Safety, Trust & Ethics Framework",
    description:
      "Learn how ClearPath responsibly demystifies bureaucracy for immigrants, refugees, and underserved communities using human-in-the-loop AI and a 5-stage document intelligence pipeline.",
    url: `${BASE_URL}/about`,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "About ClearPath — Safety, Trust & Ethics Framework",
    description:
      "Learn how ClearPath responsibly demystifies bureaucracy for immigrants, refugees, and underserved communities.",
  },
};

// JSON-LD: AboutPage schema
const aboutPageJsonLd = {
  "@context": "https://schema.org",
  "@type": "AboutPage",
  "@id": `${BASE_URL}/about/#webpage`,
  name: "About ClearPath — Safety, Trust & Ethics Framework",
  url: `${BASE_URL}/about`,
  description:
    "ClearPath is an AI-powered document intelligence platform purpose-built to help immigrants, refugees, and underserved communities securely navigate complex administrative systems using human-in-the-loop design, adversarial defense, and a 5-stage orchestrated LLM pipeline.",
  inLanguage: "en-US",
  isPartOf: {
    "@type": "WebSite",
    "@id": `${BASE_URL}/#website`,
  },
  about: {
    "@type": "Organization",
    "@id": `${BASE_URL}/#organization`,
  },
  mainEntity: {
    "@type": "Organization",
    "@id": `${BASE_URL}/#organization`,
    name: "ClearPath",
    description:
      "ClearPath bridges the clarity gap between dense institutional notices and real human families who face displacement, financial loss, or lost opportunities over hidden fine print.",
    knowsAbout: [
      "Document Intelligence",
      "AI Plain Language Processing",
      "Immigrant and Refugee Support",
      "Human-in-the-Loop AI",
      "Bureaucratic Document Analysis",
    ],
    ethicsPolicy: `${BASE_URL}/safety`,
  },
};

// JSON-LD: BreadcrumbList schema
const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      name: "Home",
      item: BASE_URL,
    },
    {
      "@type": "ListItem",
      position: 2,
      name: "About",
      item: `${BASE_URL}/about`,
    },
  ],
};

export default function AboutPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(aboutPageJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <AboutClient />
    </>
  );
}
