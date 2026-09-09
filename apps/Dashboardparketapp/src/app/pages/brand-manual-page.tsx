import React from "react";
import { Presentation } from "../components/presentation";
import { brandManualSlides } from "../components/brand-manual-slides-data";

export function BrandManualPage() {
  return (
    <div className="w-full h-screen bg-[#0A0A0A]">
      <Presentation slides={brandManualSlides} />
    </div>
  );
}
