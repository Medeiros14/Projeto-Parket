import React from "react";
import { Presentation } from "../components/presentation";
import { onboardingSlides } from "../components/onboarding-slides-data";

export function OnboardingPage() {
  return (
    <div className="w-full h-screen bg-[#0A0A0A]">
      <Presentation slides={onboardingSlides} />
    </div>
  );
}
