import React from "react";
import { Presentation } from "../components/presentation";
import { sistemaNervosoSlides } from "../components/sistema-nervoso-slides-data";

export function SistemaNervosoPage() {
  return (
    <div className="w-full h-screen bg-[#0A0A0A]">
      <Presentation slides={sistemaNervosoSlides} backLink={{ label: "Hub", href: "/" }} />
    </div>
  );
}
