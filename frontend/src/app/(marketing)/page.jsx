import HeroSection from "@/components/landing/HeroSection";
import HowItWorks from "@/components/landing/HowItWorks";
import FeatureCards from "@/components/landing/FeatureCards";
import DemoPreview from "@/components/landing/DemoPreview";
import TrustSection from "@/components/landing/TrustSection";

const BASE_URL = "https://clearpath.wahb.space";

export const metadata = {
  title: "ClearPath — Turn Confusion Into Clarity",
  description:
    "ClearPath uses AI to instantly explain confusing school letters, government forms, and community notices in plain language. Get deadlines, action plans, and trusted links — in seconds.",
  alternates: {
    canonical: BASE_URL,
  },
  openGraph: {
    title: "ClearPath — Turn Confusion Into Clarity",
    description:
      "ClearPath uses AI to instantly explain confusing school letters, government forms, and community notices in plain language. Get deadlines, action plans, and trusted links — in seconds.",
    url: BASE_URL,
    type: "website",
  },
};

// JSON-LD: SoftwareApplication schema for the landing page
const softwareAppJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "@id": `${BASE_URL}/#app`,
  name: "ClearPath",
  alternateName: "ClearPath AI Document Intelligence",
  url: BASE_URL,
  applicationCategory: "UtilitiesApplication",
  applicationSubCategory: "Document Analysis",
  operatingSystem: "Web Browser",
  browserRequirements: "Requires JavaScript. Requires HTML5.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
    description: "Free AI-powered document analysis for individuals and families.",
  },
  description:
    "ClearPath is an AI-powered document intelligence platform that transforms confusing school notices, government forms, and community documents into plain-language summaries, deadlines, and action plans.",
  featureList: [
    "AI plain-language document summaries",
    "Automated deadline extraction",
    "Action plan generation",
    "Human verification gate before AI processing",
    "OCR support for scanned documents",
    "Multi-language document support",
    "Trusted official source linking",
  ],
  screenshot: `${BASE_URL}/android-chrome-512x512.png`,
  provider: {
    "@type": "Organization",
    "@id": `${BASE_URL}/#organization`,
    name: "ClearPath",
  },
  audience: {
    "@type": "Audience",
    audienceType:
      "Students, Parents, Immigrants, Refugees, Caregivers, Underserved Communities",
  },
  inLanguage: "en-US",
};

// JSON-LD: FAQPage schema — boosts rich results for common questions
const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What is ClearPath?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "ClearPath is an AI-powered document intelligence platform that helps students, parents, immigrants, and caregivers understand complex school notices, government forms, and community documents in plain language — instantly.",
      },
    },
    {
      "@type": "Question",
      name: "How does ClearPath analyze documents?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "ClearPath uses a multi-stage AI pipeline: it first securely ingests and extracts text from your document (including scanned images via OCR), then pauses for a human verification step before running a 5-stage LLM analysis that produces plain-language summaries, deadlines, action items, and trusted source links.",
      },
    },
    {
      "@type": "Question",
      name: "Is ClearPath free to use?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. ClearPath offers free AI-powered document analysis for individuals, students, parents, and families.",
      },
    },
    {
      "@type": "Question",
      name: "What types of documents can ClearPath analyze?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "ClearPath can analyze school notices, attendance warnings, enrollment letters, scholarship applications, government forms, legal notices, and other administrative or bureaucratic documents.",
      },
    },
    {
      "@type": "Question",
      name: "Is my document data kept private?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. ClearPath uses isolated data containers and adversarial defense mechanisms to keep your document data private and secure. Documents are processed in isolated pipelines and are never shared.",
      },
    },
  ],
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareAppJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <div style={{ background: "hsl(222, 47%, 5%)" }}>
        <HeroSection />
        <HowItWorks />
        <FeatureCards />
        <DemoPreview />
        <TrustSection />
      </div>
    </>
  );
}
