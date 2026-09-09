import React from "react";
import { Presentation } from "../components/presentation";
import { journeyPlaybookSlides } from "../components/journey-playbook-slides-data";

export function JourneyPlaybookPage() {
  return (
    <div className="w-full h-screen bg-[#0A0A0A]">
      <Presentation slides={journeyPlaybookSlides} backLink={{ label: "Hub", href: "/" }} />
    </div>
  );
}
