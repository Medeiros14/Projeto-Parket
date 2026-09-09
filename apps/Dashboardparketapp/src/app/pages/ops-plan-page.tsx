import React from "react";
import { Presentation } from "../components/presentation";
import { opsPlanSlides } from "../components/ops-plan-slides-data";

export function OpsPlanPage() {
  return (
    <div className="w-full h-screen bg-[#0A0A0A]">
      <Presentation slides={opsPlanSlides} />
    </div>
  );
}
