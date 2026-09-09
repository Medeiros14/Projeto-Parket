import React from "react";
import { Presentation } from "../components/presentation";
import { objecoesSlides } from "../components/objecoes-slides-data";

export function ObjecoesPage() {
  return (
    <div className="w-full h-screen bg-[#0A0A0A]">
      <Presentation slides={objecoesSlides} />
    </div>
  );
}
