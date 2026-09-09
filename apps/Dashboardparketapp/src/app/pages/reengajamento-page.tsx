import React from "react";
import { Presentation } from "../components/presentation";
import { reengajamentoSlides } from "../components/reengajamento-slides-data";

export function ReengajamentoPage() {
  return (
    <div className="w-full h-screen bg-[#0A0A0A]">
      <Presentation slides={reengajamentoSlides} />
    </div>
  );
}
