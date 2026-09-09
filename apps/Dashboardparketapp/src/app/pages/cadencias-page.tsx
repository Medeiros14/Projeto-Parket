import React from "react";
import { Presentation } from "../components/presentation";
import { cadenciasSlides } from "../components/cadencias-slides-data";

export function CadenciasPage() {
  return (
    <div className="w-full h-screen bg-[#0A0A0A]">
      <Presentation slides={cadenciasSlides} />
    </div>
  );
}
