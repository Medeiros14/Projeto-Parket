import React from "react";
import { Presentation } from "../components/presentation";
import { playbookObrasSlides } from "../components/playbook-obras-slides-data";

export function PlaybookObrasPage() {
  return (
    <div className="w-full h-screen bg-[#0A0A0A]">
      <Presentation slides={playbookObrasSlides} backLink={{ label: "Hub", href: "/" }} />
    </div>
  );
}
