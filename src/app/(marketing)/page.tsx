import type { Metadata } from "next";
import HeroSection from "@/components/landing/HeroSection";
import HowItWorks from "@/components/landing/HowItWorks";
import FeatureCards from "@/components/landing/FeatureCards";
import DemoPreview from "@/components/landing/DemoPreview";
import TrustSection from "@/components/landing/TrustSection";

export const metadata: Metadata = {
  title: "ClearPath — Turn Confusion Into Clarity",
  description:
    "ClearPath uses AI to instantly explain confusing school letters, government forms, and community notices in plain language. Get deadlines, action plans, and trusted links — in seconds.",
};

export default function HomePage() {
  return (
    <div>
      <HeroSection />
      <HowItWorks />
      <FeatureCards />
      <DemoPreview />
      <TrustSection />
    </div>
  );
}
