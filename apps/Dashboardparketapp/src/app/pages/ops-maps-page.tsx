import React from "react";
import { Presentation } from "../components/presentation";
import { opsMapsSlides } from "../components/ops-maps-slides-data";

export function OpsMapsPage() {
  return (
    <div className="w-full h-screen bg-[#0A0A0A]">
      <Presentation slides={opsMapsSlides} />
    </div>
  );
}
