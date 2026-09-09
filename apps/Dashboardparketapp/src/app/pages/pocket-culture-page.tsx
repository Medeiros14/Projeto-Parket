import React from "react";
import { Presentation } from "../components/presentation";
import { pocketCultureSlides } from "../components/pocket-culture-slides-data";

export function PocketCulturePage() {
  return (
    <div className="w-full h-screen bg-[#0A0A0A]">
      <Presentation slides={pocketCultureSlides} backLink={{ label: "Hub", href: "/" }} />
    </div>
  );
}
