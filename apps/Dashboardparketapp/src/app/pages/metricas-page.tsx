import React from "react";
import { Presentation } from "../components/presentation";
import { metricasSlides } from "../components/metricas-slides-data";

export function MetricasPage() {
  return (
    <div className="w-full h-screen bg-[#0A0A0A]">
      <Presentation slides={metricasSlides} />
    </div>
  );
}
