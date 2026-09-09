import React from "react";
import { Presentation } from "../components/presentation";
import { commandCenterSlides } from "../components/command-center-slides-data";

export function CommandCenterPage() {
  return (
    <div className="w-full h-screen bg-[#0A0A0A]">
      <Presentation slides={commandCenterSlides} backLink={{ label: "Hub", href: "/" }} />
    </div>
  );
}
