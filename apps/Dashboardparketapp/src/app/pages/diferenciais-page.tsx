import React from "react";
import { Presentation } from "../components/presentation";
import { diferenciaisSlides } from "../components/diferenciais-slides-data";

export function DiferenciaisPage() {
  return (
    <div className="w-full h-screen bg-[#0A0A0A]">
      <Presentation slides={diferenciaisSlides} />
    </div>
  );
}
