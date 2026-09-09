import React from "react";
import { Presentation } from "../components/presentation";
import { strategicPlanSlides } from "../components/strategic-plan-slides-data";

export function StrategicPlanPage() {
  return (
    <div className="w-full h-screen bg-[#0A0A0A]">
      <Presentation slides={strategicPlanSlides} backLink={{ label: "Hub", href: "/" }} />
    </div>
  );
}
