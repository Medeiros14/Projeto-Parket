import React from "react";
import { Presentation } from "../components/presentation";
import { atendimentoPlaybookSlides } from "../components/atendimento-playbook-slides-data";

export function AtendimentoPlaybookPage() {
  return (
    <div className="w-full h-screen bg-[#0A0A0A]">
      <Presentation slides={atendimentoPlaybookSlides} backLink={{ label: "Hub", href: "/" }} />
    </div>
  );
}
