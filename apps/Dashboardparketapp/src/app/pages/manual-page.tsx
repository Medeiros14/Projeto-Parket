import React from "react";
import { Presentation } from "../components/presentation";
import { manualSlides } from "../components/manual-slides-data";

export function ManualPage() {
  return (
    <div className="w-full h-screen bg-[#0A0A0A]">
      <Presentation slides={manualSlides} />
    </div>
  );
}
